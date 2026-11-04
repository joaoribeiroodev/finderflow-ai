import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runStructuredAI } from "@/lib/ai/engine";
import type { AIResult } from "@/lib/ai/provider";
import { proposalDraftSchema, type ProposalDraft } from "@/lib/ai/schemas";
import { logger } from "@/lib/logger/logger";
import { getLeadDetail } from "@/modules/leads/leads.service";
import { listActiveServices } from "@/modules/services/services.service";
import type { Database } from "@/types/database";

import { buildProposalAssistantInput, PROMPT_KEYS, PROMPT_VERSIONS, PROPOSAL_ASSISTANT_INSTRUCTIONS } from "./prompts";

type Supabase = SupabaseClient<Database>;

export class LeadNotFoundForDraftError extends Error {
  constructor() {
    super("Lead não encontrado.");
    this.name = "LeadNotFoundForDraftError";
  }
}

/**
 * Gera um rascunho de escopo/itens de proposta (Proposal Assistant). O
 * resultado NUNCA é inserido diretamente em `proposals`/`proposal_items`
 * — é só sugestão para o vendedor revisar e, se concordar, criar os
 * itens manualmente (mesmo princípio de "usuário sempre revisa antes de
 * enviar" já aplicado ao Outreach Generator na Fase 5).
 */
export async function generateProposalDraft(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<AIResult<ProposalDraft>> {
  const lead = await getLeadDetail(supabase, organizationId, leadId);
  if (!lead) throw new LeadNotFoundForDraftError();

  const services = await listActiveServices(supabase, organizationId);

  const result = await runStructuredAI(supabase, organizationId, {
    promptKey: PROMPT_KEYS.proposalAssistant,
    promptVersion: PROMPT_VERSIONS.proposalAssistant,
    instructions: PROPOSAL_ASSISTANT_INSTRUCTIONS,
    input: buildProposalAssistantInput(lead, services),
    schema: proposalDraftSchema,
    schemaName: "proposal_draft",
  });

  if (result.status === "completed" && result.data) {
    const { error } = await supabase.from("ai_analyses").insert({
      organization_id: organizationId,
      lead_id: leadId,
      analysis_type: "proposal_draft",
      result: result.data,
      sources: result.sources,
      model: result.model,
      prompt_version: result.promptVersion,
    });

    if (error) {
      logger.error("Falha ao persistir rascunho de proposta", { error: error.message, organizationId, leadId });
    }
  }

  return result;
}

export async function listProposalDrafts(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<ProposalDraft[]> {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("result")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .eq("analysis_type", "proposal_draft")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    logger.error("Falha ao listar rascunhos de proposta", { error: error.message, organizationId, leadId });
    return [];
  }

  return (data ?? []).map((row) => row.result as ProposalDraft);
}
