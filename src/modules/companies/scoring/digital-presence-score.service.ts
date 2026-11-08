import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import { getCompanyById } from "@/modules/companies/companies.service";
import type { Database, Json } from "@/types/database";

import { computeDigitalPresenceScore, type DigitalPresenceCriteria } from "./digital-presence-score";

type Supabase = SupabaseClient<Database>;

export class CompanyNotFoundForScoringError extends Error {
  constructor() {
    super("Empresa não encontrada.");
    this.name = "CompanyNotFoundForScoringError";
  }
}

export interface DigitalPresenceScoreRow {
  id: string;
  score: number;
  criteria: DigitalPresenceCriteria;
  computedAt: string;
}

/**
 * Recalcula e grava uma nova linha de histórico (nunca sobrescreve a
 * anterior — ver migration). Chamado automaticamente depois de aceitar
 * um campo de enriquecimento (Módulo 1) e também disponível como ação
 * manual ("Recalcular pontuação" na página da empresa), para empresas
 * com dados anteriores ao Módulo 1 existir.
 */
export async function recomputeDigitalPresenceScore(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<DigitalPresenceScoreRow> {
  const company = await getCompanyById(supabase, organizationId, companyId);
  if (!company) throw new CompanyNotFoundForScoringError();

  const { score, criteria } = computeDigitalPresenceScore({
    website: company.website,
    email: company.email,
    phone: company.phone,
    socialLinks: (company.social_links ?? {}) as Record<string, string | null | undefined>,
  });

  const { data, error } = await supabase
    .from("digital_presence_scores")
    .insert({
      organization_id: organizationId,
      company_id: companyId,
      score,
      criteria: criteria as unknown as Json,
    })
    .select("id, score, criteria, computed_at")
    .single();

  if (error || !data) {
    logger.error("Falha ao gravar pontuação de presença digital", {
      error: error?.message,
      organizationId,
      companyId,
    });
    throw new Error("Não foi possível calcular a pontuação de presença digital.");
  }

  return {
    id: data.id,
    score: data.score,
    criteria: data.criteria as unknown as DigitalPresenceCriteria,
    computedAt: data.computed_at,
  };
}

/** Última pontuação calculada para a empresa, ou `null` se nunca foi calculada. */
export async function getLatestDigitalPresenceScore(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<DigitalPresenceScoreRow | null> {
  const { data, error } = await supabase
    .from("digital_presence_scores")
    .select("id, score, criteria, computed_at")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao buscar pontuação de presença digital", {
      error: error.message,
      organizationId,
      companyId,
    });
    throw new Error("Não foi possível carregar a pontuação de presença digital.");
  }
  if (!data) return null;

  return {
    id: data.id,
    score: data.score,
    criteria: data.criteria as unknown as DigitalPresenceCriteria,
    computedAt: data.computed_at,
  };
}
