import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export interface ReportPeriod {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Período do relatório, SEMPRE em limites de dia civil UTC — mesma regra
 * de timezone já documentada no dashboard/entitlements (nunca o timezone
 * do navegador de quem está olhando, para o número não variar por
 * pessoa). `from`/`to` vêm de `YYYY-MM-DD` da UI; o padrão sem filtro é
 * o mês civil atual.
 */
export function resolveReportPeriod(from?: string, to?: string, now: Date = new Date()): ReportPeriod {
  const start = from
    ? new Date(`${from}T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = to ? new Date(`${to}T23:59:59.999Z`) : now;
  return {
    start,
    end,
    label: `${start.toISOString().slice(0, 10)} a ${end.toISOString().slice(0, 10)}`,
  };
}

export interface ConversionBreakdown {
  key: string;
  label: string;
  won: number;
  lost: number;
  conversionRate: number | null;
}

export function buildConversionBreakdown(
  entries: { key: string; label: string; status: "won" | "lost" }[],
): ConversionBreakdown[] {
  const byKey = new Map<string, { label: string; won: number; lost: number }>();

  for (const entry of entries) {
    const current = byKey.get(entry.key) ?? { label: entry.label, won: 0, lost: 0 };
    if (entry.status === "won") current.won += 1;
    else current.lost += 1;
    byKey.set(entry.key, current);
  }

  return Array.from(byKey.entries())
    .map(([key, v]) => ({
      key,
      label: v.label,
      won: v.won,
      lost: v.lost,
      conversionRate: v.won + v.lost > 0 ? v.won / (v.won + v.lost) : null,
    }))
    .sort((a, b) => b.won + b.lost - (a.won + a.lost));
}

export interface CampaignPerformanceData {
  /** Empresas adicionadas a uma campanha no período (`campaign_companies.added_at`). */
  totalCompanies: number;
  contactedCount: number;
  respondedCount: number;
  excludedCount: number;
  /** respondido ÷ (contatado + respondido) — null se nenhuma mensagem foi enviada ainda. */
  responseRate: number | null;
}

export interface CadenceOutcomesData {
  /** Inscrições iniciadas no período (`cadence_enrollments.started_at`). */
  enrollmentsStarted: number;
  activeCount: number;
  pausedCount: number;
  stoppedCount: number;
  completedCount: number;
  stoppedReasons: { reason: string; count: number }[];
  stepSends: { status: "sent" | "failed" | "skipped"; count: number }[];
}

/**
 * Módulo 10 — Inteligência de Conversão. "Taxa de resposta" é um proxy
 * honesto sobre o que o sistema realmente sabe — não há rastreamento de
 * abertura/clique de e-mail (nenhum provedor com webhook de tracking
 * está integrado). `responded` só é marcado quando um humano confirma
 * manualmente que a empresa respondeu (Módulo 6) — nunca inferido
 * automaticamente de um evento de e-mail.
 */
export function computeCampaignPerformance(
  rows: { status: string }[],
): CampaignPerformanceData {
  const contactedCount = rows.filter((r) => r.status === "contacted").length;
  const respondedCount = rows.filter((r) => r.status === "responded").length;
  const outreachTotal = contactedCount + respondedCount;
  return {
    totalCompanies: rows.length,
    contactedCount,
    respondedCount,
    excludedCount: rows.filter((r) => r.status === "excluded").length,
    responseRate: outreachTotal > 0 ? respondedCount / outreachTotal : null,
  };
}

/**
 * Mesma lógica para cadências: "respondeu" só existe quando o usuário
 * clica "Marcar como respondeu" (Módulo 7) — nunca inferido do conteúdo
 * de uma resposta de e-mail real, que o sistema não lê.
 */
export function computeCadenceOutcomes(
  enrollments: { status: string; stopped_reason: string | null }[],
  stepSends: { status: string }[],
): CadenceOutcomesData {
  const stoppedReasonCounts = new Map<string, number>();
  for (const row of enrollments) {
    if (row.status !== "stopped") continue;
    const reason = row.stopped_reason?.trim() || "Sem motivo registrado";
    stoppedReasonCounts.set(reason, (stoppedReasonCounts.get(reason) ?? 0) + 1);
  }
  return {
    enrollmentsStarted: enrollments.length,
    activeCount: enrollments.filter((r) => r.status === "active").length,
    pausedCount: enrollments.filter((r) => r.status === "paused").length,
    stoppedCount: enrollments.filter((r) => r.status === "stopped").length,
    completedCount: enrollments.filter((r) => r.status === "completed").length,
    stoppedReasons: Array.from(stoppedReasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    stepSends: (["sent", "failed", "skipped"] as const).map((status) => ({
      status,
      count: stepSends.filter((r) => r.status === status).length,
    })),
  };
}

export interface ReportsData {
  conversionBySegment: ConversionBreakdown[];
  conversionByOrigin: ConversionBreakdown[];
  conversionByResponsible: ConversionBreakdown[];
  conversionByStage: ConversionBreakdown[];
  conversionByService: ConversionBreakdown[];
  avgCycleTimeDays: number | null;
  avgTicket: number | null;
  lossReasons: { reason: string; count: number }[];
  aiUsage: { operation: string; count: number; estimatedCostUsd: number }[];
  campaignPerformance: CampaignPerformanceData;
  cadenceOutcomes: CadenceOutcomesData;
}

/**
 * Conversão = leads que chegaram a uma etapa de resultado (ganho/perdido)
 * dentro do período, pelo próprio `updated_at` do lead (atualizado
 * atomicamente por `move_lead_stage`, Fase 4) — a MESMA definição usada
 * em todo o relatório, nunca recalculada de outro jeito em cada aba.
 */
export async function getReportsData(
  supabase: Supabase,
  organizationId: string,
  period: ReportPeriod,
): Promise<ReportsData> {
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();

  const [closedLeadsRes, stageHistoryRes, proposalItemsRes, dealsRes, aiUsageRes, campaignCompaniesRes, cadenceEnrollmentsRes, cadenceStepSendsRes] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, status, created_at, updated_at, assigned_to, stage_id, company:companies!leads_company_same_org_fk(category, origin)",
      )
      .eq("organization_id", organizationId)
      .in("status", ["won", "lost"])
      .gte("updated_at", startIso)
      .lte("updated_at", endIso),
    supabase
      .from("lead_stage_history")
      .select("lead_id, to_stage_id, stage:pipeline_stages!stage_history_to_stage_same_org_fk(name)")
      .eq("organization_id", organizationId)
      .gte("changed_at", startIso)
      .lte("changed_at", endIso),
    supabase
      .from("proposal_items")
      .select("service_id, service:services(name), proposal:proposals!proposal_items_proposal_same_org_fk(status)")
      .eq("organization_id", organizationId)
      .not("service_id", "is", null),
    supabase
      .from("deals")
      .select("amount, status, closed_at, lost_reason")
      .eq("organization_id", organizationId)
      .eq("status", "won")
      .gte("closed_at", startIso)
      .lte("closed_at", endIso),
    supabase
      .from("ai_usage_events")
      .select("operation, estimated_cost")
      .eq("organization_id", organizationId)
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("campaign_companies")
      .select("status")
      .eq("organization_id", organizationId)
      .gte("added_at", startIso)
      .lte("added_at", endIso),
    supabase
      .from("cadence_enrollments")
      .select("status, stopped_reason")
      .eq("organization_id", organizationId)
      .gte("started_at", startIso)
      .lte("started_at", endIso),
    supabase
      .from("cadence_step_sends")
      .select("status")
      .eq("organization_id", organizationId)
      .gte("sent_at", startIso)
      .lte("sent_at", endIso),
  ]);

  for (const [label, res] of [
    ["closed_leads", closedLeadsRes],
    ["stage_history", stageHistoryRes],
    ["proposal_items", proposalItemsRes],
    ["deals", dealsRes],
    ["ai_usage", aiUsageRes],
    ["campaign_companies", campaignCompaniesRes],
    ["cadence_enrollments", cadenceEnrollmentsRes],
    ["cadence_step_sends", cadenceStepSendsRes],
  ] as const) {
    if (res.error) {
      logger.error(`Falha ao calcular relatório (${label})`, { error: res.error.message, organizationId });
    }
  }

  const closedLeads = closedLeadsRes.data ?? [];

  const segmentEntries = closedLeads.map((lead) => ({
    key: lead.company?.category?.trim() || "Sem categoria",
    label: lead.company?.category?.trim() || "Sem categoria",
    status: lead.status as "won" | "lost",
  }));

  const originEntries = closedLeads.map((lead) => ({
    key: lead.company?.origin ?? "other",
    label: lead.company?.origin ?? "other",
    status: lead.status as "won" | "lost",
  }));

  const assignedIds = Array.from(new Set(closedLeads.map((l) => l.assigned_to).filter((id): id is string => id !== null)));
  const profileNameById = new Map<string, string>();
  if (assignedIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", assignedIds);
    if (profilesError) {
      logger.error("Falha ao carregar responsáveis para relatório", { error: profilesError.message, organizationId });
    } else {
      for (const profile of profiles ?? []) {
        profileNameById.set(profile.id, profile.full_name ?? "Sem nome");
      }
    }
  }

  const responsibleEntries = closedLeads.map((lead) => ({
    key: lead.assigned_to ?? "unassigned",
    label: lead.assigned_to ? profileNameById.get(lead.assigned_to) ?? "Sem nome" : "Sem responsável",
    status: lead.status as "won" | "lost",
  }));

  // Conversão por etapa: para cada etapa pela qual um lead passou (histórico
  // dentro do período), contamos o resultado final do lead — um lead que
  // passou por várias etapas conta para todas elas (é assim que se mede
  // "quais etapas aparecem mais em negociações ganhas/perdidas").
  const leadOutcomeById = new Map(closedLeads.map((l) => [l.id, l.status as "won" | "lost"]));
  const stageEntries = (stageHistoryRes.data ?? [])
    .filter((row) => leadOutcomeById.has(row.lead_id) && row.stage !== null)
    .map((row) => ({
      key: row.to_stage_id,
      label: row.stage!.name,
      status: leadOutcomeById.get(row.lead_id)!,
    }));

  const serviceEntries = (proposalItemsRes.data ?? [])
    .filter(
      (row): row is typeof row & { service: { name: string }; proposal: { status: string } } =>
        row.service !== null && row.proposal !== null && (row.proposal.status === "accepted" || row.proposal.status === "rejected"),
    )
    .map((row) => ({
      key: row.service_id as string,
      label: row.service.name,
      status: (row.proposal.status === "accepted" ? "won" : "lost") as "won" | "lost",
    }));

  const wonDeals = dealsRes.data ?? [];
  const avgTicket = wonDeals.length > 0 ? wonDeals.reduce((s, d) => s + Number(d.amount), 0) / wonDeals.length : null;

  const cycleDurationsDays = closedLeads.map(
    (lead) => (new Date(lead.updated_at).getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24),
  );
  const avgCycleTimeDays =
    cycleDurationsDays.length > 0
      ? cycleDurationsDays.reduce((s, d) => s + d, 0) / cycleDurationsDays.length
      : null;

  // `loss_reason` não foi incluído no select de `closedLeads` acima (não
  // era necessário para os outros agrupamentos) — buscamos separadamente
  // só para os leads perdidos deste período.
  const lostLeadIds = closedLeads.filter((l) => l.status === "lost").map((l) => l.id);
  let lossReasons: { reason: string; count: number }[] = [];
  if (lostLeadIds.length > 0) {
    const { data: lostLeads, error: lostError } = await supabase
      .from("leads")
      .select("loss_reason")
      .eq("organization_id", organizationId)
      .in("id", lostLeadIds);

    if (lostError) {
      logger.error("Falha ao carregar motivos de perda", { error: lostError.message, organizationId });
    } else {
      const counts = new Map<string, number>();
      for (const row of lostLeads ?? []) {
        const reason = row.loss_reason?.trim() || "Sem motivo registrado";
        counts.set(reason, (counts.get(reason) ?? 0) + 1);
      }
      lossReasons = Array.from(counts.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);
    }
  }

  const aiUsageCounts = new Map<string, { count: number; cost: number }>();
  for (const event of aiUsageRes.data ?? []) {
    const current = aiUsageCounts.get(event.operation) ?? { count: 0, cost: 0 };
    current.count += 1;
    current.cost += Number(event.estimated_cost);
    aiUsageCounts.set(event.operation, current);
  }
  const aiUsage = Array.from(aiUsageCounts.entries())
    .map(([operation, v]) => ({ operation, count: v.count, estimatedCostUsd: v.cost }))
    .sort((a, b) => b.count - a.count);

  const campaignPerformance = computeCampaignPerformance(campaignCompaniesRes.data ?? []);
  const cadenceOutcomes = computeCadenceOutcomes(cadenceEnrollmentsRes.data ?? [], cadenceStepSendsRes.data ?? []);

  return {
    conversionBySegment: buildConversionBreakdown(segmentEntries),
    conversionByOrigin: buildConversionBreakdown(originEntries),
    conversionByResponsible: buildConversionBreakdown(responsibleEntries),
    conversionByStage: buildConversionBreakdown(stageEntries),
    conversionByService: buildConversionBreakdown(serviceEntries),
    avgCycleTimeDays,
    avgTicket,
    lossReasons,
    aiUsage,
    campaignPerformance,
    cadenceOutcomes,
  };
}
