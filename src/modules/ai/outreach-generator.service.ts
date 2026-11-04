import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runStructuredAI } from "@/lib/ai/engine";
import type { AIResult } from "@/lib/ai/provider";
import { outreachMessageSchema, type OutreachMessage } from "@/lib/ai/schemas";
import { logger } from "@/lib/logger/logger";
import { getLeadDetail } from "@/modules/leads/leads.service";
import type { Database } from "@/types/database";

import { buildOutreachGeneratorInput, OUTREACH_GENERATOR_INSTRUCTIONS, PROMPT_KEYS, PROMPT_VERSIONS } from "./prompts";
import { LeadNotFoundError } from "./lead-scorer.service";

type Supabase = SupabaseClient<Database>;

export type OutreachChannel = "email" | "whatsapp" | "phone_script" | "linkedin";

/**
 * Gera um rascunho de abordagem/follow-up para um lead. O rascunho é
 * SEMPRE apresentado como material para revisão humana — nada aqui
 * dispara envio automático de mensagem (isso exigiria confirmação
 * explícita do usuário, fora do escopo desta chamada, e integrações de
 * envio — WhatsApp/e-mail transacional — são Fase futura, docs/05-integrations.md §5.4).
 */
export async function generateOutreachMessage(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
  channel: OutreachChannel,
): Promise<AIResult<OutreachMessage>> {
  const lead = await getLeadDetail(supabase, organizationId, leadId);
  if (!lead) throw new LeadNotFoundError();

  const result = await runStructuredAI(supabase, organizationId, {
    promptKey: PROMPT_KEYS.outreachGenerator,
    promptVersion: PROMPT_VERSIONS.outreachGenerator,
    instructions: OUTREACH_GENERATOR_INSTRUCTIONS,
    input: buildOutreachGeneratorInput(lead, channel),
    schema: outreachMessageSchema,
    schemaName: "outreach_message",
  });

  if (result.status === "completed" && result.data) {
    const { error } = await supabase.from("ai_analyses").insert({
      organization_id: organizationId,
      lead_id: leadId,
      company_id: lead.company_id,
      analysis_type: "outreach_message",
      result: result.data,
      score: null,
      sources: result.sources,
      model: result.model,
      prompt_version: result.promptVersion,
    });

    if (error) {
      logger.error("Falha ao persistir rascunho de abordagem", {
        error: error.message,
        organizationId,
        leadId,
      });
    }
  }

  return result;
}

export type OutreachAnalysisRow = Database["public"]["Tables"]["ai_analyses"]["Row"];

export async function listOutreachMessages(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<OutreachAnalysisRow[]> {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .eq("analysis_type", "outreach_message")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar rascunhos de abordagem", { error: error.message, organizationId, leadId });
    throw new Error("Não foi possível carregar os rascunhos deste lead.");
  }

  return data ?? [];
}
