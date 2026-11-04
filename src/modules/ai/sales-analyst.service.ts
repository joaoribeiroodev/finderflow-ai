import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runStructuredAI } from "@/lib/ai/engine";
import type { AIResult } from "@/lib/ai/provider";
import { salesInsightsSchema, type SalesInsights } from "@/lib/ai/schemas";
import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

import {
  buildSalesAnalystInput,
  PROMPT_KEYS,
  PROMPT_VERSIONS,
  SALES_ANALYST_INSTRUCTIONS,
  type SalesAnalystMetrics,
} from "./prompts";

type Supabase = SupabaseClient<Database>;

export type PeriodPreset = "last_30_days" | "current_month" | "last_90_days";

export function resolvePeriod(preset: PeriodPreset, now: Date = new Date()): { start: Date; end: Date; label: string } {
  const end = now;
  if (preset === "current_month") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { start, end, label: `${start.toLocaleDateString("pt-BR")} até ${end.toLocaleDateString("pt-BR")} (mês atual)` };
  }
  const days = preset === "last_90_days" ? 90 : 30;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end, label: `últimos ${days} dias (${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")})` };
}

/**
 * Calcula, no servidor, todas as métricas que o Sales Analyst vai
 * interpretar — a IA nunca recebe permissão para calcular um número
 * sozinha (ver instruções em `prompts.ts`). Esta função é a ÚNICA
 * definição de cada métrica usada pelo recurso; se divergir da definição
 * usada em `/reports`, isso é um bug, não uma segunda métrica válida.
 */
export async function computeSalesAnalystMetrics(
  supabase: Supabase,
  organizationId: string,
  period: { start: Date; end: Date; label: string },
): Promise<SalesAnalystMetrics> {
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();

  const [companiesRes, leadsRes, proposalsSentRes, proposalsAcceptedRes, dealsRes] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("archived_at", null),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "sent")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "accepted")
      .gte("updated_at", startIso)
      .lte("updated_at", endIso),
    supabase
      .from("deals")
      .select("status, amount, lost_reason, closed_at")
      .eq("organization_id", organizationId)
      .in("status", ["won", "lost"])
      .gte("closed_at", startIso)
      .lte("closed_at", endIso),
  ]);

  for (const [label, res] of [
    ["companies", companiesRes],
    ["leads", leadsRes],
    ["proposals_sent", proposalsSentRes],
    ["proposals_accepted", proposalsAcceptedRes],
    ["deals", dealsRes],
  ] as const) {
    if (res.error) {
      logger.error(`Falha ao calcular métrica do Sales Analyst (${label})`, { error: res.error.message, organizationId });
    }
  }

  const deals = dealsRes.data ?? [];
  const wonDeals = deals.filter((d) => d.status === "won");
  const lostDeals = deals.filter((d) => d.status === "lost");
  const wonRevenue = wonDeals.reduce((sum, d) => sum + Number(d.amount), 0);
  const avgTicket = wonDeals.length > 0 ? wonRevenue / wonDeals.length : null;

  const lostReasonCounts = new Map<string, number>();
  for (const deal of lostDeals) {
    const reason = deal.lost_reason?.trim() || "Sem motivo registrado";
    lostReasonCounts.set(reason, (lostReasonCounts.get(reason) ?? 0) + 1);
  }
  const lostReasons = Array.from(lostReasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    periodLabel: period.label,
    companiesCount: companiesRes.count ?? 0,
    newLeadsCount: leadsRes.count ?? 0,
    proposalsSentCount: proposalsSentRes.count ?? 0,
    proposalsAcceptedCount: proposalsAcceptedRes.count ?? 0,
    wonDealsCount: wonDeals.length,
    lostDealsCount: lostDeals.length,
    wonRevenue,
    avgTicket,
    lostReasons,
  };
}

export async function generateSalesInsights(
  supabase: Supabase,
  organizationId: string,
  preset: PeriodPreset,
): Promise<AIResult<SalesInsights>> {
  const period = resolvePeriod(preset);
  const metrics = await computeSalesAnalystMetrics(supabase, organizationId, period);

  const result = await runStructuredAI(supabase, organizationId, {
    promptKey: PROMPT_KEYS.salesAnalyst,
    promptVersion: PROMPT_VERSIONS.salesAnalyst,
    instructions: SALES_ANALYST_INSTRUCTIONS,
    input: buildSalesAnalystInput(metrics),
    schema: salesInsightsSchema,
    schemaName: "sales_insights",
  });

  if (result.status === "completed" && result.data) {
    const { error } = await supabase.from("ai_analyses").insert({
      organization_id: organizationId,
      analysis_type: "sales_insights",
      result: result.data,
      sources: result.sources,
      model: result.model,
      prompt_version: result.promptVersion,
    });

    if (error) {
      logger.error("Falha ao persistir insights de vendas", { error: error.message, organizationId });
    }
  }

  return result;
}

export async function getLatestSalesInsights(
  supabase: Supabase,
  organizationId: string,
): Promise<SalesInsights | null> {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("result")
    .eq("organization_id", organizationId)
    .eq("analysis_type", "sales_insights")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao carregar últimos insights de vendas", { error: error.message, organizationId });
    return null;
  }

  return (data?.result as SalesInsights | undefined) ?? null;
}
