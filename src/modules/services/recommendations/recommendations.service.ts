import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

import { rankRecommendations, summarizeByService, type ServiceRecommendationRow } from "./rank-recommendations";

type Supabase = SupabaseClient<Database>;

function isPriority(value: string | null): value is "low" | "medium" | "high" {
  return value === "low" || value === "medium" || value === "high";
}

export interface ServiceRecommendationFilters {
  serviceId?: string;
  priority?: "low" | "medium" | "high";
}

/**
 * Módulo 5 — lê a view `latest_company_service_opportunities` (achata as
 * `opportunities` da análise de IA mais recente de cada empresa — ver
 * migration `module5_service_recommendations`) e devolve a lista já
 * ordenada por prioridade/potencial. Nenhuma chamada de IA é feita aqui:
 * é puramente leitura e reagregação do que o Company Analyzer (Fase 5)
 * já gerou e persistiu em `ai_analyses`.
 */
export async function listServiceRecommendations(
  supabase: Supabase,
  organizationId: string,
  filters: ServiceRecommendationFilters = {},
): Promise<ServiceRecommendationRow[]> {
  let query = supabase
    .from("latest_company_service_opportunities")
    .select("*")
    .eq("organization_id", organizationId);

  if (filters.serviceId) query = query.eq("service_id", filters.serviceId);
  if (filters.priority) query = query.eq("priority", filters.priority);

  const { data, error } = await query;

  if (error) {
    logger.error("Falha ao listar recomendações de serviços", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar as recomendações de serviços.");
  }

  // A view sempre preenche estas colunas (vêm de um join/cross join lateral
  // sem left join), mas o gerador de tipos marca toda coluna de view como
  // nullable — por isso os fallbacks abaixo em vez de um `as` que ignoraria
  // a possibilidade real de `null` em tempo de compilação.
  const rows: ServiceRecommendationRow[] = (data ?? [])
    .filter((row) => row.company_id && row.analysis_id && row.service_name)
    .map((row) => ({
      companyId: row.company_id as string,
      companyName: row.company_name ?? "Empresa sem nome",
      analysisId: row.analysis_id as string,
      companyScore: row.company_score,
      analyzedAt: row.analyzed_at ?? "",
      serviceId: row.service_id,
      serviceName: row.service_name as string,
      reason: row.reason ?? "",
      priority: isPriority(row.priority) ? row.priority : "low",
    }));

  return rankRecommendations(rows);
}

export { summarizeByService };
export type { ServiceRecommendationRow } from "./rank-recommendations";
