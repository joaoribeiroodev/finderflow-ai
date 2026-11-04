import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { LeadDetailsUpdateInput } from "@/lib/validation/leads";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;
export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type InteractionRow = Database["public"]["Tables"]["interactions"]["Row"];
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type StageHistoryRow = Database["public"]["Tables"]["lead_stage_history"]["Row"];

const PAGE_SIZE = 20;

export interface LeadListItem extends LeadRow {
  company: { id: string; name: string; category: string | null } | null;
  stage: { id: string; name: string; color: string; is_closed: boolean } | null;
}

export interface LeadListFilters {
  search?: string;
  stageId?: string;
  priority?: string;
  page?: number;
}

export interface LeadListResult {
  leads: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Lista leads da organização ativa. Busca livre é feita pelo nome da
 * empresa associada (join `companies`), não pela tabela `leads` em si
 * (que não tem nome próprio).
 */
export async function listLeads(
  supabase: Supabase,
  organizationId: string,
  filters: LeadListFilters = {},
): Promise<LeadListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("leads")
    .select("*, company:companies!leads_company_same_org_fk(id, name, category), stage:pipeline_stages!leads_stage_same_org_fk(id, name, color, is_closed)", {
      count: "exact",
    })
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (filters.stageId) query = query.eq("stage_id", filters.stageId);
  if (filters.priority) query = query.eq("priority", filters.priority as LeadRow["priority"]);

  const { data, error, count } = await query;

  if (error) {
    logger.error("Falha ao listar leads", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar os leads.");
  }

  let leads = (data ?? []) as unknown as LeadListItem[];

  if (filters.search && filters.search.trim().length > 0) {
    const term = filters.search.trim().toLowerCase();
    leads = leads.filter((lead) => lead.company?.name.toLowerCase().includes(term));
  }

  return { leads, total: count ?? 0, page, pageSize: PAGE_SIZE };
}

/**
 * Lista todos os leads abertos para o Kanban, sem paginação (agrupamento
 * por etapa precisa do conjunto completo). Para volumes grandes de leads
 * isso deveria ganhar paginação por coluna/virtualização — fora do
 * escopo desta fase, registrado em docs/DECISIONS.md.
 */
export async function listLeadsForKanban(
  supabase: Supabase,
  organizationId: string,
): Promise<LeadListItem[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*, company:companies!leads_company_same_org_fk(id, name, category), stage:pipeline_stages!leads_stage_same_org_fk(id, name, color, is_closed)")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar leads para o Kanban", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar o pipeline.");
  }

  return (data ?? []) as unknown as LeadListItem[];
}

/** Lista compacta para seletores (ex.: criar proposta a partir de um lead). */
export async function listLeadsForSelect(
  supabase: Supabase,
  organizationId: string,
): Promise<{ id: string; companyName: string }[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, company:companies!leads_company_same_org_fk(name)")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    logger.error("Falha ao listar leads para seletor", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar os leads.");
  }

  return (data ?? [])
    .filter((row): row is typeof row & { company: { name: string } } => row.company !== null)
    .map((row) => ({ id: row.id, companyName: row.company.name }));
}

export interface LeadDetail extends LeadRow {
  company: Database["public"]["Tables"]["companies"]["Row"] | null;
  stage: Database["public"]["Tables"]["pipeline_stages"]["Row"] | null;
  contacts: ContactRow[];
  interactions: InteractionRow[];
  tasks: TaskRow[];
  stageHistory: StageHistoryRow[];
}

export async function getLeadDetail(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<LeadDetail | null> {
  const { data: lead, error } = await supabase
    .from("leads")
    .select("*, company:companies!leads_company_same_org_fk(*), stage:pipeline_stages!leads_stage_same_org_fk(*)")
    .eq("organization_id", organizationId)
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao buscar lead", { error: error.message, organizationId, leadId });
    throw new Error("Não foi possível carregar o lead.");
  }
  if (!lead) return null;

  const [{ data: contacts }, { data: interactions }, { data: tasks }, { data: stageHistory }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("company_id", lead.company_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("interactions")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("lead_id", leadId)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("lead_id", leadId)
        .order("due_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("lead_stage_history")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("lead_id", leadId)
        .order("changed_at", { ascending: false }),
    ]);

  return {
    ...(lead as unknown as LeadRow),
    company: (lead as unknown as { company: Database["public"]["Tables"]["companies"]["Row"] | null }).company,
    stage: (lead as unknown as { stage: Database["public"]["Tables"]["pipeline_stages"]["Row"] | null }).stage,
    contacts: contacts ?? [],
    interactions: interactions ?? [],
    tasks: tasks ?? [],
    stageHistory: stageHistory ?? [],
  };
}

export async function updateLeadDetails(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
  input: LeadDetailsUpdateInput,
): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({
      priority: input.priority,
      estimated_value: input.estimatedValue ?? null,
      probability: input.probability ?? null,
      service_interest: input.serviceInterest ?? null,
      next_contact_at: input.nextContactAt ?? null,
    })
    .eq("organization_id", organizationId)
    .eq("id", leadId);

  if (error) {
    logger.error("Falha ao atualizar lead", { error: error.message, organizationId, leadId });
    throw new Error("Não foi possível atualizar o lead.");
  }
}

export class InvalidStageTransitionError extends Error {
  constructor(message = "Não foi possível mover o lead para esta etapa.") {
    super(message);
    this.name = "InvalidStageTransitionError";
  }
}

/**
 * Move o lead de etapa de forma atômica, via RPC `move_lead_stage`
 * (ver migration create_pipeline_functions): a própria função no banco
 * registra o histórico (`lead_stage_history`) e sincroniza
 * `leads.status`/`loss_reason` com o `result_type` da etapa de destino —
 * nunca duas chamadas separadas do cliente, que teriam uma janela de
 * corrida entre ler a etapa atual e gravar o histórico.
 */
export async function moveLeadStage(
  supabase: Supabase,
  leadId: string,
  toStageId: string,
  lossReason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("move_lead_stage", {
    p_lead_id: leadId,
    p_to_stage_id: toStageId,
    ...(lossReason ? { p_loss_reason: lossReason } : {}),
  });

  if (error) {
    logger.error("Falha ao mover lead de etapa", { error: error.message, leadId, toStageId });
    throw new InvalidStageTransitionError();
  }
}

export async function archiveLead(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", leadId);

  if (error) {
    logger.error("Falha ao arquivar lead", { error: error.message, organizationId, leadId });
    throw new Error("Não foi possível arquivar o lead.");
  }
}
