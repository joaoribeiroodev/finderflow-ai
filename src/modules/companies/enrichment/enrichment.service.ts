import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import { getCompanyById } from "@/modules/companies/companies.service";
import { getWebPresenceChecker } from "@/modules/companies/presence/get-web-presence-checker";
import type { Database } from "@/types/database";

import { extractContactFields, type ExtractedField } from "./extract-contacts";

/**
 * Módulo 1 — Enriquecimento Inteligente de Empresas (ver
 * ETAPA-0-AUDITORIA.md, recomendação de próxima fase ao final da Fase 10:
 * "é o que mais reaproveita o que já existe... e alimenta os módulos de
 * Score/Scoring depois").
 *
 * Nunca escreve direto nas colunas de `companies` — cada achado é uma
 * *proposta* em `company_enrichment_fields`, revisada por um humano
 * (aceitar/rejeitar) antes de valer. Reaproveita `getWebPresenceChecker()`
 * (Fase de prospecção) só para achar uma URL candidata quando a empresa
 * não tem `website` cadastrado; quando já tem, busca o HTML diretamente.
 */

type Supabase = SupabaseClient<Database>;

const FETCH_TIMEOUT_MS = 8_000;
/** Corta páginas gigantes antes de regexar — nenhum site legítimo de pequena/média empresa deveria passar disso. */
const MAX_HTML_CHARS = 2_000_000;

export class CompanyNotFoundForEnrichmentError extends Error {
  constructor() {
    super("Empresa não encontrada.");
    this.name = "CompanyNotFoundForEnrichmentError";
  }
}

export type EnrichmentStatus = "completed" | "no_website" | "fetch_failed";

export interface EnrichmentOutcome {
  status: EnrichmentStatus;
  proposedCount: number;
  websiteUrl?: string;
}

function toAbsoluteUrl(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; FinderFlowAI/1.0; +https://finderflow.ai)",
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    return html.slice(0, MAX_HTML_CHARS);
  } catch (error) {
    logger.warn("Falha ao buscar site para enriquecimento", { error: (error as Error).message, url });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Descobre e propõe campos para uma empresa. Idempotente por natureza:
 * re-scans não duplicam propostas pendentes idênticas (unique constraint
 * `(company_id, field_key, field_value)` — colisão é tratada como
 * esperado, não como falha).
 */
export async function enrichCompany(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<EnrichmentOutcome> {
  const company = await getCompanyById(supabase, organizationId, companyId);
  if (!company) throw new CompanyNotFoundForEnrichmentError();

  const hadWebsite = Boolean(company.website?.trim());
  let websiteUrl = hadWebsite ? toAbsoluteUrl(company.website!.trim()) : null;
  let discoveryChecker: string | null = null;

  if (!websiteUrl) {
    const checker = getWebPresenceChecker();
    if (checker) {
      const presence = await checker.check({ companyName: company.name });
      if (presence.hasWebsite && presence.websiteUrl) {
        websiteUrl = presence.websiteUrl;
        discoveryChecker = checker.name;
      }
    }
  }

  if (!websiteUrl) {
    return { status: "no_website", proposedCount: 0 };
  }

  const html = await fetchHtml(websiteUrl);
  if (!html) {
    return { status: "fetch_failed", proposedCount: 0, websiteUrl };
  }

  const extracted: ExtractedField[] = [];
  // O próprio site encontrado também é uma proposta — a empresa não tinha `website` cadastrado.
  if (!hadWebsite && discoveryChecker) {
    extracted.push({
      fieldKey: "website",
      fieldValue: websiteUrl,
      source: `web_presence_check:${discoveryChecker}`,
      // Indício, não certeza — mesmo caveat do próprio DomainProbeWebPresenceChecker.
      confidence: 0.6,
    });
  }
  extracted.push(...extractContactFields(html, websiteUrl));

  const alreadyKnown = new Set<string>();
  if (company.email) alreadyKnown.add(`email:${company.email.toLowerCase()}`);
  if (company.phone) alreadyKnown.add(`phone:${company.phone.replace(/\D/g, "")}`);
  const socialLinks = (company.social_links ?? {}) as Record<string, string>;
  for (const [platform, link] of Object.entries(socialLinks)) {
    if (link) alreadyKnown.add(`social_${platform}:${link.toLowerCase()}`);
  }

  let proposedCount = 0;
  for (const field of extracted) {
    const dedupeKey =
      field.fieldKey === "phone"
        ? `phone:${field.fieldValue.replace(/\D/g, "")}`
        : `${field.fieldKey}:${field.fieldValue.toLowerCase()}`;
    if (alreadyKnown.has(dedupeKey)) continue;

    const { error } = await supabase.from("company_enrichment_fields").insert({
      organization_id: organizationId,
      company_id: companyId,
      field_key: field.fieldKey,
      field_value: field.fieldValue,
      source: field.source,
      confidence: field.confidence,
      is_ai_inferred: false,
    });

    if (error) {
      // 23505 = já existia uma proposta pendente idêntica — esperado em re-scans, não é falha.
      if (error.code !== "23505") {
        logger.error("Falha ao propor campo de enriquecimento", {
          error: error.message,
          organizationId,
          companyId,
          fieldKey: field.fieldKey,
        });
      }
      continue;
    }
    proposedCount += 1;
  }

  return { status: "completed", proposedCount, websiteUrl };
}

export interface EnrichmentFieldRow {
  id: string;
  fieldKey: string;
  fieldValue: string;
  source: string;
  confidence: number;
  status: string;
  discoveredAt: string;
}

export async function listPendingEnrichmentFields(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<EnrichmentFieldRow[]> {
  const { data, error } = await supabase
    .from("company_enrichment_fields")
    .select("id, field_key, field_value, source, confidence, status, discovered_at")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .eq("status", "pending")
    .order("discovered_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar campos propostos de enriquecimento", {
      error: error.message,
      organizationId,
      companyId,
    });
    throw new Error("Não foi possível carregar os campos propostos.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    fieldKey: row.field_key,
    fieldValue: row.field_value,
    source: row.source,
    confidence: Number(row.confidence),
    status: row.status,
    discoveredAt: row.discovered_at,
  }));
}

export interface ReviewOutcome {
  companyId: string;
  fieldKey: string;
  fieldValue: string;
}

/**
 * Aceita ou rejeita uma proposta. Em caso de aceite, grava o valor real
 * na coluna correspondente de `companies` (ou faz merge em `social_links`
 * — é jsonb, nunca sobrescreve as outras redes já salvas). `null` quando
 * o campo não existe, não pertence à organização, ou já foi revisado
 * antes (nunca re-revisa silenciosamente).
 */
export async function reviewEnrichmentField(
  supabase: Supabase,
  organizationId: string,
  fieldId: string,
  decision: "accepted" | "rejected",
  reviewerId: string | null,
): Promise<ReviewOutcome | null> {
  const { data: field, error: fetchError } = await supabase
    .from("company_enrichment_fields")
    .select("id, company_id, field_key, field_value, status")
    .eq("organization_id", organizationId)
    .eq("id", fieldId)
    .maybeSingle();

  if (fetchError || !field || field.status !== "pending") return null;

  if (decision === "accepted") {
    if (field.field_key === "email" || field.field_key === "phone" || field.field_key === "website") {
      // Chave explícita por campo (em vez de `{ [field.field_key]: ... }`) — o tipo gerado do
      // supabase-js para `update()` não aceita um índice dinâmico aqui.
      const patch =
        field.field_key === "email"
          ? { email: field.field_value }
          : field.field_key === "phone"
            ? { phone: field.field_value }
            : { website: field.field_value };
      const { error: updateError } = await supabase
        .from("companies")
        .update(patch)
        .eq("organization_id", organizationId)
        .eq("id", field.company_id);
      if (updateError) {
        logger.error("Falha ao aplicar campo aceito na empresa", {
          error: updateError.message,
          organizationId,
          fieldId,
        });
        throw new Error("Não foi possível aplicar o valor aceito à empresa.");
      }
    } else if (field.field_key.startsWith("social_")) {
      const platform = field.field_key.slice("social_".length);
      const { data: companyRow, error: companyError } = await supabase
        .from("companies")
        .select("social_links")
        .eq("organization_id", organizationId)
        .eq("id", field.company_id)
        .maybeSingle();

      if (companyError) {
        logger.error("Falha ao ler social_links antes de aplicar aceite", {
          error: companyError.message,
          organizationId,
          fieldId,
        });
        throw new Error("Não foi possível aplicar o valor aceito à empresa.");
      }

      const currentLinks = (companyRow?.social_links ?? {}) as Record<string, string>;
      const { error: updateError } = await supabase
        .from("companies")
        .update({ social_links: { ...currentLinks, [platform]: field.field_value } })
        .eq("organization_id", organizationId)
        .eq("id", field.company_id);

      if (updateError) {
        logger.error("Falha ao aplicar rede social aceita na empresa", {
          error: updateError.message,
          organizationId,
          fieldId,
        });
        throw new Error("Não foi possível aplicar o valor aceito à empresa.");
      }
    }
  }

  const { error: reviewError } = await supabase
    .from("company_enrichment_fields")
    .update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: reviewerId })
    .eq("organization_id", organizationId)
    .eq("id", fieldId);

  if (reviewError) {
    logger.error("Falha ao revisar campo de enriquecimento", {
      error: reviewError.message,
      organizationId,
      fieldId,
    });
    throw new Error("Não foi possível registrar a revisão.");
  }

  return { companyId: field.company_id, fieldKey: field.field_key, fieldValue: field.field_value };
}
