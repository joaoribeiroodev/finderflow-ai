import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

import { buildAttributionLabel } from "./shared";
import type { SearchResultView } from "./actions";

type Supabase = SupabaseClient<Database>;
export type SearchRow = Database["public"]["Tables"]["searches"]["Row"];

const PAGE_SIZE = 15;

export interface SearchHistoryListResult {
  searches: SearchRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Lista as buscas já feitas pela organização (tabela `searches`), mais
 * recentes primeiro — a base do "histórico de busca" pedido pelo
 * usuário: poder voltar numa busca anterior sem gastar uma nova
 * requisição ao provedor. RLS garante o escopo por organização.
 */
export async function listSearchHistory(
  supabase: Supabase,
  organizationId: string,
  page = 1,
): Promise<SearchHistoryListResult> {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("searches")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    logger.error("Falha ao listar histórico de buscas", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar o histórico de buscas.");
  }

  return { searches: data ?? [], total: count ?? 0, page: safePage, pageSize: PAGE_SIZE };
}

/**
 * Reconstrói os resultados de uma busca já feita a partir do que está
 * salvo em `search_results` — **nenhuma chamada ao provedor externo**,
 * por isso revisitar uma busca antiga nunca consome cota de API. Essa
 * é a mesma forma (`SearchResultView`) usada pela busca em tempo real
 * (`searchCompaniesAction`), então a UI de histórico reaproveita o
 * mesmo componente de listagem/ações (converter, verificar site).
 */
export async function getSearchWithResults(
  supabase: Supabase,
  organizationId: string,
  searchId: string,
): Promise<{ search: SearchRow; results: SearchResultView[] } | null> {
  const { data: search, error: searchError } = await supabase
    .from("searches")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", searchId)
    .maybeSingle();

  if (searchError) {
    logger.error("Falha ao buscar registro de busca do histórico", {
      error: searchError.message,
      organizationId,
      searchId,
    });
    throw new Error("Não foi possível carregar esta busca.");
  }
  if (!search) return null;

  const { data: resultRows, error: resultsError } = await supabase
    .from("search_results")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("search_id", searchId)
    .order("fetched_at", { ascending: true });

  if (resultsError) {
    logger.error("Falha ao carregar resultados salvos da busca", {
      error: resultsError.message,
      organizationId,
      searchId,
    });
    throw new Error("Não foi possível carregar os resultados desta busca.");
  }

  const results: SearchResultView[] = (resultRows ?? []).map(mapResultRowToView);

  return { search, results };
}

/**
 * Função pura (sem I/O) — reconstrói um `SearchResultView` a partir de
 * uma linha salva de `search_results`. Extraída para ser testável sem
 * mockar o Supabase.
 */
export function mapResultRowToView(row: {
  id: string;
  display_data: unknown;
  attribution: unknown;
  company_id: string | null;
}): SearchResultView {
  const displayData = (row.display_data ?? {}) as Record<string, unknown>;
  const attribution = (row.attribution ?? {}) as Record<string, unknown>;
  const webPresence = displayData.webPresence as { hasWebsite?: unknown; websiteUrl?: unknown } | undefined;
  const cachedWebPresence =
    webPresence && typeof webPresence.hasWebsite === "boolean"
      ? {
          hasWebsite: webPresence.hasWebsite,
          websiteUrl: typeof webPresence.websiteUrl === "string" ? webPresence.websiteUrl : undefined,
        }
      : undefined;

  return {
    searchResultId: row.id,
    name: typeof displayData.name === "string" ? displayData.name : "(sem nome)",
    category: typeof displayData.category === "string" ? displayData.category : undefined,
    address: typeof displayData.address === "string" ? displayData.address : undefined,
    phone: typeof displayData.phone === "string" ? displayData.phone : undefined,
    attributionLabel: buildAttributionLabel(attribution),
    alreadyConverted: Boolean(row.company_id),
    cachedWebPresence,
  };
}
