import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { DealStatus } from "@/lib/validation/deals";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;
export type DealRow = Database["public"]["Tables"]["deals"]["Row"];

export class DealAlreadyExistsError extends Error {
  constructor() {
    super("Esta proposta já tem um negócio vinculado.");
    this.name = "DealAlreadyExistsError";
  }
}

export class DealNotFoundError extends Error {
  constructor() {
    super("Negócio não encontrado.");
    this.name = "DealNotFoundError";
  }
}

export class DealAlreadyClosedError extends Error {
  constructor() {
    super("Este negócio já foi encerrado.");
    this.name = "DealAlreadyClosedError";
  }
}

/**
 * Cria um negócio a partir de uma proposta — título/valor derivados da
 * proposta no momento da conversão (não acompanham mudanças posteriores
 * na proposta: um negócio registra o que foi efetivamente negociado
 * naquele momento, não um espelho vivo da proposta).
 */
export async function createDealFromProposal(
  supabase: Supabase,
  organizationId: string,
  proposalId: string,
  leadId: string,
  title: string,
  amount: number,
): Promise<DealRow> {
  const { data, error } = await supabase
    .from("deals")
    .insert({
      organization_id: organizationId,
      lead_id: leadId,
      proposal_id: proposalId,
      title,
      amount,
      status: "open",
    })
    .select("*")
    .single();

  if (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") throw new DealAlreadyExistsError();
    logger.error("Falha ao criar negócio", { error: error.message, organizationId, proposalId });
    throw new Error("Não foi possível criar o negócio.");
  }

  return data;
}

export async function closeDeal(
  supabase: Supabase,
  organizationId: string,
  dealId: string,
  status: Extract<DealStatus, "won" | "lost">,
  lostReason: string | undefined,
): Promise<DealRow> {
  const { data: existing, error: fetchError } = await supabase
    .from("deals")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", dealId)
    .maybeSingle();

  if (fetchError) {
    logger.error("Falha ao carregar negócio", { error: fetchError.message, organizationId, dealId });
    throw new Error("Não foi possível carregar o negócio.");
  }
  if (!existing) throw new DealNotFoundError();
  if (existing.status !== "open") throw new DealAlreadyClosedError();

  const { data, error } = await supabase
    .from("deals")
    .update({
      status,
      lost_reason: status === "lost" ? (lostReason ?? null) : null,
      closed_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("id", dealId)
    .select("*")
    .single();

  if (error) {
    logger.error("Falha ao encerrar negócio", { error: error.message, organizationId, dealId });
    throw new Error("Não foi possível encerrar o negócio.");
  }

  return data;
}

export async function listDealsForLead(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<DealRow[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar negócios do lead", { error: error.message, organizationId, leadId });
    throw new Error("Não foi possível carregar os negócios deste lead.");
  }

  return data ?? [];
}
