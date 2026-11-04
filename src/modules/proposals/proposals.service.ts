import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { ProposalItemInput } from "@/lib/validation/proposals";
import type { ProposalStatus } from "@/lib/validation/proposals";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;
export type ProposalRow = Database["public"]["Tables"]["proposals"]["Row"];
export type ProposalItemRow = Database["public"]["Tables"]["proposal_items"]["Row"];
export type DealRow = Database["public"]["Tables"]["deals"]["Row"];

export interface ProposalListItem extends ProposalRow {
  lead: { id: string; company: { id: string; name: string } | null } | null;
}

const PAGE_SIZE = 20;

export class LeadNotFoundError extends Error {
  constructor() {
    super("Lead não encontrado.");
    this.name = "LeadNotFoundError";
  }
}

export class ProposalNotFoundError extends Error {
  constructor() {
    super("Proposta não encontrada.");
    this.name = "ProposalNotFoundError";
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Não é possível mudar a proposta de "${from}" para "${to}".`);
    this.name = "InvalidStatusTransitionError";
  }
}

export interface ProposalListFilters {
  status?: ProposalStatus;
  leadId?: string;
  page?: number;
}

export async function listProposals(
  supabase: Supabase,
  organizationId: string,
  filters: ProposalListFilters = {},
): Promise<{ proposals: ProposalListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("proposals")
    .select(
      "*, lead:leads!proposals_lead_same_org_fk(id, company:companies!leads_company_same_org_fk(id, name))",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.leadId) query = query.eq("lead_id", filters.leadId);

  const { data, error, count } = await query;

  if (error) {
    logger.error("Falha ao listar propostas", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar as propostas.");
  }

  return { proposals: (data ?? []) as unknown as ProposalListItem[], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export interface ProposalDetail extends ProposalRow {
  lead: { id: string; company: { id: string; name: string } | null } | null;
  items: ProposalItemRow[];
  deal: DealRow | null;
}

export async function getProposalDetail(
  supabase: Supabase,
  organizationId: string,
  proposalId: string,
): Promise<ProposalDetail | null> {
  const [{ data: proposal, error: proposalError }, { data: items, error: itemsError }, { data: deal, error: dealError }] =
    await Promise.all([
      supabase
        .from("proposals")
        .select(
          "*, lead:leads!proposals_lead_same_org_fk(id, company:companies!leads_company_same_org_fk(id, name))",
        )
        .eq("organization_id", organizationId)
        .eq("id", proposalId)
        .maybeSingle(),
      supabase
        .from("proposal_items")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("proposal_id", proposalId)
        .order("description", { ascending: true }),
      supabase
        .from("deals")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("proposal_id", proposalId)
        .maybeSingle(),
    ]);

  if (proposalError) {
    logger.error("Falha ao carregar proposta", { error: proposalError.message, organizationId, proposalId });
    throw new Error("Não foi possível carregar a proposta.");
  }
  if (!proposal) return null;
  if (itemsError) {
    logger.error("Falha ao carregar itens da proposta", { error: itemsError.message, organizationId, proposalId });
    throw new Error("Não foi possível carregar os itens da proposta.");
  }
  if (dealError) {
    logger.error("Falha ao carregar negócio da proposta", { error: dealError.message, organizationId, proposalId });
  }

  return { ...(proposal as unknown as ProposalDetail), items: items ?? [], deal: deal ?? null };
}

/**
 * Gera o próximo número de proposta sequencial da organização
 * (`PROP-00001`, `PROP-00002`, ...). Não há uma sequência dedicada no
 * banco — em vez disso, lemos o maior número já emitido e tentamos +1,
 * com uma repetição em caso de conflito de concorrência (mesmo padrão já
 * usado no checkout do Asaas para a unicidade de assinatura ativa:
 * tratar o erro 23505 do Postgres em vez de serializar com um lock
 * explícito, aceitável no volume esperado desta fase).
 */
async function nextProposalNumber(supabase: Supabase, organizationId: string): Promise<string> {
  const { data, error } = await supabase
    .from("proposals")
    .select("proposal_number")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    logger.error("Falha ao calcular próximo número de proposta", { error: error.message, organizationId });
  }

  const last = data?.[0]?.proposal_number;
  const lastSeq = last ? Number(last.replace(/[^0-9]/g, "")) : 0;
  const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `PROP-${String(nextSeq).padStart(5, "0")}`;
}

export async function createProposal(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
  validUntil: string | undefined,
): Promise<ProposalRow> {
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    logger.error("Falha ao validar lead da proposta", { error: leadError.message, organizationId, leadId });
    throw new Error("Não foi possível validar o lead.");
  }
  if (!lead) throw new LeadNotFoundError();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const proposalNumber = await nextProposalNumber(supabase, organizationId);
    const { data, error } = await supabase
      .from("proposals")
      .insert({
        organization_id: organizationId,
        lead_id: leadId,
        proposal_number: proposalNumber,
        status: "draft",
        valid_until: validUntil ?? null,
      })
      .select("*")
      .single();

    if (!error) return data;

    // 23505 = violação de unicidade (organization_id, proposal_number) —
    // outra proposta foi criada concorrentemente com o mesmo número.
    // Repetir recalcula o próximo número a partir do estado atual.
    const pgError = error as { code?: string };
    if (pgError.code !== "23505" || attempt === 2) {
      logger.error("Falha ao criar proposta", { error: error.message, organizationId, leadId });
      throw new Error("Não foi possível criar a proposta.");
    }
  }

  throw new Error("Não foi possível criar a proposta.");
}

export async function updateProposalValidUntil(
  supabase: Supabase,
  organizationId: string,
  proposalId: string,
  validUntil: string | undefined,
): Promise<void> {
  const { error } = await supabase
    .from("proposals")
    .update({ valid_until: validUntil ?? null })
    .eq("organization_id", organizationId)
    .eq("id", proposalId);

  if (error) {
    logger.error("Falha ao atualizar validade da proposta", { error: error.message, organizationId, proposalId });
    throw new Error("Não foi possível atualizar a validade.");
  }
}

export async function updateProposalStatus(
  supabase: Supabase,
  organizationId: string,
  proposalId: string,
  newStatus: ProposalStatus,
): Promise<ProposalRow> {
  const { data, error } = await supabase
    .from("proposals")
    .update({ status: newStatus })
    .eq("organization_id", organizationId)
    .eq("id", proposalId)
    .select("*")
    .single();

  if (error) {
    logger.error("Falha ao atualizar status da proposta", { error: error.message, organizationId, proposalId });
    throw new Error("Não foi possível atualizar o status da proposta.");
  }

  return data;
}

export async function addProposalItem(
  supabase: Supabase,
  organizationId: string,
  proposalId: string,
  input: ProposalItemInput,
): Promise<ProposalItemRow> {
  const { data, error } = await supabase
    .from("proposal_items")
    .insert({
      organization_id: organizationId,
      proposal_id: proposalId,
      service_id: input.serviceId ?? null,
      description: input.description,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      // `total` é recalculado pelo trigger `proposal_items_before_write`
      // no banco — o valor enviado aqui é só para satisfazer o tipo
      // `not null` da coluna antes do trigger rodar.
      total: input.quantity * input.unitPrice,
    })
    .select("*")
    .single();

  if (error) {
    logger.error("Falha ao adicionar item à proposta", { error: error.message, organizationId, proposalId });
    throw new Error("Não foi possível adicionar o item.");
  }

  return data;
}

export async function removeProposalItem(
  supabase: Supabase,
  organizationId: string,
  proposalItemId: string,
): Promise<void> {
  const { error } = await supabase
    .from("proposal_items")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", proposalItemId);

  if (error) {
    logger.error("Falha ao remover item da proposta", { error: error.message, organizationId, proposalItemId });
    throw new Error("Não foi possível remover o item.");
  }
}

export async function listProposalsForLead(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<ProposalRow[]> {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar propostas do lead", { error: error.message, organizationId, leadId });
    throw new Error("Não foi possível carregar as propostas deste lead.");
  }

  return data ?? [];
}
