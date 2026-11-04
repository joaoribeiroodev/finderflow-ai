import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export interface PipelineStageCount {
  id: string;
  name: string;
  color: string;
  count: number;
}

export interface RecentStageChange {
  id: string;
  leadId: string;
  companyName: string;
  toStageName: string;
  changedAt: string;
}

export interface PendingTask {
  id: string;
  title: string;
  dueAt: string | null;
}

export interface DashboardData {
  companiesCount: number;
  activeLeadsCount: number;
  proposalsSentCount: number;
  weightedPipelineValue: number;
  pipeline: PipelineStageCount[];
  recentActivity: RecentStageChange[];
  pendingTasks: PendingTask[];
}

/**
 * Agrega os KPIs/funil/atividade do dashboard a partir de dados reais do
 * Supabase (RLS garante o escopo por organização — nunca filtramos por
 * `organization_id` vindo do browser). Fases 3/4/7 (empresas, leads,
 * propostas) ainda não têm telas de criação, então os números ficam
 * honestamente em zero até lá — não há fixtures/dados fictícios aqui.
 */
export async function getDashboardData(
  supabase: Supabase,
  organizationId: string,
): Promise<DashboardData> {
  const [companiesRes, leadsRes, proposalsRes, stagesRes, historyRes, tasksRes] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      supabase
        .from("leads")
        .select("id, estimated_value, probability", { count: "exact" })
        .eq("organization_id", organizationId)
        .eq("status", "open")
        .is("archived_at", null),
      supabase
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      supabase
        .from("pipeline_stages")
        .select("id, name, color, position")
        .eq("organization_id", organizationId)
        .order("position", { ascending: true }),
      supabase
        .from("lead_stage_history")
        .select(
          "id, changed_at, lead_id, to_stage:pipeline_stages!stage_history_to_stage_same_org_fk(name), lead:leads!stage_history_lead_same_org_fk(company:companies(name))",
        )
        .eq("organization_id", organizationId)
        .order("changed_at", { ascending: false })
        .limit(5),
      supabase
        .from("tasks")
        .select("id, title, due_at")
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(5),
    ]);

  for (const [label, res] of [
    ["companies", companiesRes],
    ["leads", leadsRes],
    ["proposals", proposalsRes],
    ["pipeline_stages", stagesRes],
    ["lead_stage_history", historyRes],
    ["tasks", tasksRes],
  ] as const) {
    if (res.error) {
      logger.error(`Falha ao carregar dados do dashboard (${label})`, { error: res.error.message });
    }
  }

  const openLeads = leadsRes.data ?? [];
  const weightedPipelineValue = openLeads.reduce((sum, lead) => {
    const value = Number(lead.estimated_value ?? 0);
    const probability = Number(lead.probability ?? 0) / 100;
    return sum + value * probability;
  }, 0);

  const stages = stagesRes.data ?? [];
  let pipeline: PipelineStageCount[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    count: 0,
  }));

  if (stages.length > 0) {
    const { data: leadsByStage, error: leadsByStageError } = await supabase
      .from("leads")
      .select("stage_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    if (leadsByStageError) {
      logger.error("Falha ao agrupar leads por etapa do pipeline", {
        error: leadsByStageError.message,
      });
    } else {
      const counts = new Map<string, number>();
      for (const row of leadsByStage ?? []) {
        counts.set(row.stage_id, (counts.get(row.stage_id) ?? 0) + 1);
      }
      pipeline = stages.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        count: counts.get(s.id) ?? 0,
      }));
    }
  }

  const recentActivity: RecentStageChange[] = (historyRes.data ?? [])
    .filter((row): row is typeof row & { to_stage: { name: string }; lead: { company: { name: string } } } =>
      row.to_stage !== null && row.lead !== null && row.lead.company !== null,
    )
    .map((row) => ({
      id: row.id,
      leadId: row.lead_id,
      companyName: row.lead.company.name,
      toStageName: row.to_stage.name,
      changedAt: row.changed_at,
    }));

  const pendingTasks: PendingTask[] = (tasksRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.due_at,
  }));

  return {
    companiesCount: companiesRes.count ?? 0,
    activeLeadsCount: leadsRes.count ?? 0,
    proposalsSentCount: proposalsRes.count ?? 0,
    weightedPipelineValue,
    pipeline,
    recentActivity,
    pendingTasks,
  };
}
