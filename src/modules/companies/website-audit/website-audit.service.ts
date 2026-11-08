import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import { resolveOrgPageSpeedApiKey } from "@/lib/integrations/resolve-org-pagespeed-key";
import {
  extractWebsiteAuditSignals,
  fetchPageSpeedResult,
  PageSpeedApiError,
  type WebsiteAuditIssue,
} from "@/lib/integrations/pagespeed-client";
import { getCompanyById } from "@/modules/companies/companies.service";
import type { Database, Json } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export class CompanyNotFoundForAuditError extends Error {
  constructor() {
    super("Empresa não encontrada.");
    this.name = "CompanyNotFoundForAuditError";
  }
}

export class CompanyWithoutWebsiteError extends Error {
  constructor() {
    super("Esta empresa não tem um site cadastrado para auditar.");
    this.name = "CompanyWithoutWebsiteError";
  }
}

export class PageSpeedNotConfiguredError extends Error {
  constructor() {
    super("Configure a chave da PageSpeed Insights em Configurações → Integrações antes de rodar uma auditoria.");
    this.name = "PageSpeedNotConfiguredError";
  }
}

export interface WebsiteAuditRow {
  id: string;
  url: string;
  status: "completed" | "failed";
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  largestContentfulPaintMs: number | null;
  cumulativeLayoutShift: number | null;
  totalBlockingTimeMs: number | null;
  issues: WebsiteAuditIssue[];
  errorMessage: string | null;
  runAt: string;
}

function normalizeWebsiteUrl(website: string): string {
  return website.startsWith("http://") || website.startsWith("https://") ? website : `https://${website}`;
}

function mapRow(data: {
  id: string;
  url: string;
  status: string;
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  largest_contentful_paint_ms: number | null;
  cumulative_layout_shift: number | null;
  total_blocking_time_ms: number | null;
  issues: Json;
  error_message: string | null;
  run_at: string;
}): WebsiteAuditRow {
  return {
    id: data.id,
    url: data.url,
    status: data.status as "completed" | "failed",
    performanceScore: data.performance_score,
    accessibilityScore: data.accessibility_score,
    bestPracticesScore: data.best_practices_score,
    seoScore: data.seo_score,
    largestContentfulPaintMs: data.largest_contentful_paint_ms,
    cumulativeLayoutShift: data.cumulative_layout_shift,
    totalBlockingTimeMs: data.total_blocking_time_ms,
    issues: (data.issues ?? []) as unknown as WebsiteAuditIssue[],
    errorMessage: data.error_message,
    runAt: data.run_at,
  };
}

const SELECT_COLUMNS =
  "id, url, status, performance_score, accessibility_score, best_practices_score, seo_score, largest_contentful_paint_ms, cumulative_layout_shift, total_blocking_time_ms, issues, error_message, run_at";

/**
 * Roda a auditoria de site (Módulo 2) para uma empresa e grava o
 * resultado como uma nova linha de histórico — nunca sobrescreve a
 * anterior (mesmo princípio de `digital_presence_scores`), inclusive em
 * caso de falha (status 'failed' + error_message), para o histórico
 * mostrar tentativas e não só sucessos.
 *
 * Síncrono (não passa pela fila assíncrona da Fase 10): uma chamada à
 * PageSpeed API normalmente responde em poucos segundos; o timeout de
 * 25s em `fetchPageSpeedResult` dá margem segura dentro do limite de
 * função da Vercel. Decisão registrada em docs/DECISIONS.md.
 */
export async function runWebsiteAudit(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<WebsiteAuditRow> {
  const company = await getCompanyById(supabase, organizationId, companyId);
  if (!company) throw new CompanyNotFoundForAuditError();
  if (!company.website?.trim()) throw new CompanyWithoutWebsiteError();

  const apiKey = await resolveOrgPageSpeedApiKey(organizationId);
  if (!apiKey) throw new PageSpeedNotConfiguredError();

  const url = normalizeWebsiteUrl(company.website.trim());

  let insertPayload: Record<string, unknown>;
  try {
    const raw = await fetchPageSpeedResult(url, apiKey, "mobile");
    const signals = extractWebsiteAuditSignals(raw);
    insertPayload = {
      organization_id: organizationId,
      company_id: companyId,
      url,
      strategy: "mobile",
      status: "completed",
      performance_score: signals.performanceScore,
      accessibility_score: signals.accessibilityScore,
      best_practices_score: signals.bestPracticesScore,
      seo_score: signals.seoScore,
      largest_contentful_paint_ms: signals.largestContentfulPaintMs,
      cumulative_layout_shift: signals.cumulativeLayoutShift,
      total_blocking_time_ms: signals.totalBlockingTimeMs,
      issues: signals.issues as unknown as Json,
    };
  } catch (error) {
    const message = error instanceof PageSpeedApiError ? error.message : "Falha inesperada ao consultar a PageSpeed API.";
    logger.error("Falha ao rodar auditoria de site", { error: message, organizationId, companyId, url });
    insertPayload = {
      organization_id: organizationId,
      company_id: companyId,
      url,
      strategy: "mobile",
      status: "failed",
      error_message: message,
      issues: [] as unknown as Json,
    };
  }

  const { data, error } = await supabase
    .from("website_audits")
    .insert(insertPayload as never)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    logger.error("Falha ao gravar auditoria de site", { error: error?.message, organizationId, companyId });
    throw new Error("Não foi possível gravar o resultado da auditoria de site.");
  }

  const row = mapRow(data);
  if (row.status === "failed") {
    // Propaga como sucesso de gravação, mas quem chamar (action) decide
    // se trata `status: 'failed'` como "falha visível ao usuário" — a
    // auditoria em si foi persistida corretamente.
    return row;
  }
  return row;
}

/** Última auditoria registrada para a empresa, ou `null` se nunca foi rodada. */
export async function getLatestWebsiteAudit(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<WebsiteAuditRow | null> {
  const { data, error } = await supabase
    .from("website_audits")
    .select(SELECT_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .order("run_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao buscar auditoria de site", { error: error.message, organizationId, companyId });
    throw new Error("Não foi possível carregar a auditoria de site.");
  }
  if (!data) return null;

  return mapRow(data);
}
