import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runStructuredAI } from "@/lib/ai/engine";
import type { AIResult } from "@/lib/ai/provider";
import { leadScoreSchema, type LeadScoreResult } from "@/lib/ai/schemas";
import { logger } from "@/lib/logger/logger";
import { getLeadDetail } from "@/modules/leads/leads.service";
import { recordLeadScoreDimensions } from "@/modules/leads/scoring/lead-score-dimensions.service";
import type { Database } from "@/types/database";

import { buildLeadScorerInput, LEAD_SCORER_INSTRUCTIONS, PROMPT_KEYS, PROMPT_VERSIONS } from "./prompts";

type Supabase = SupabaseClient<Database>;

export class LeadNotFoundError extends Error {
  constructor() {
    super("Lead não encontrado.");
    this.name = "LeadNotFoundError";
  }
}

/**
 * Executa o Lead Scorer e, em caso de sucesso, persiste a análise em
 * `ai_analyses` E atualiza `leads.score` (para refletir no detalhe/lista
 * de leads sem precisar relançar a análise). O `score` nunca é exibido
 * como "probabilidade de compra" em nenhuma UI que leia este resultado —
 * ver docs/DECISIONS.md e o comentário em `prompts.ts`.
 */
export async function scoreLead(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<AIResult<LeadScoreResult>> {
  const lead = await getLeadDetail(supabase, organizationId, leadId);
  if (!lead) throw new LeadNotFoundError();

  const result = await runStructuredAI(supabase, organizationId, {
    promptKey: PROMPT_KEYS.leadScorer,
    promptVersion: PROMPT_VERSIONS.leadScorer,
    instructions: LEAD_SCORER_INSTRUCTIONS,
    input: buildLeadScorerInput(lead),
    schema: leadScoreSchema,
    schemaName: "lead_score",
  });

  if (result.status === "completed" && result.data) {
    const { error: insertError } = await supabase.from("ai_analyses").insert({
      organization_id: organizationId,
      lead_id: leadId,
      company_id: lead.company_id,
      analysis_type: "lead_score",
      result: result.data,
      score: result.data.score,
      sources: result.sources,
      model: result.model,
      prompt_version: result.promptVersion,
    });

    if (insertError) {
      logger.error("Falha ao persistir qualificação de lead", {
        error: insertError.message,
        organizationId,
        leadId,
      });
    }

    const { error: updateError } = await supabase
      .from("leads")
      .update({ score: result.data.score })
      .eq("organization_id", organizationId)
      .eq("id", leadId);

    if (updateError) {
      logger.error("Falha ao atualizar score do lead", {
        error: updateError.message,
        organizationId,
        leadId,
      });
    }

    // Módulo 4 — Lead Scoring 2.0: decompõe o mesmo resultado em 3 dimensões
    // (nunca uma nova chamada de IA). Best-effort — nunca invalida a
    // qualificação em si se a gravação do histórico falhar.
    try {
      await recordLeadScoreDimensions(
        supabase,
        organizationId,
        leadId,
        result.data.score_breakdown,
        result.model,
        result.promptVersion,
      );
    } catch (dimensionsError) {
      logger.warn("Falha ao gravar dimensões do Lead Scoring 2.0", {
        error: (dimensionsError as Error).message,
        organizationId,
        leadId,
      });
    }
  }

  return result;
}

export type LeadAnalysisRow = Database["public"]["Tables"]["ai_analyses"]["Row"];

export async function listLeadAnalyses(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<LeadAnalysisRow[]> {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar análises do lead", { error: error.message, organizationId, leadId });
    throw new Error("Não foi possível carregar as análises deste lead.");
  }

  return data ?? [];
}
