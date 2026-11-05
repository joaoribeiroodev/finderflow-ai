"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger/logger";
import type { Json } from "@/types/database";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { createCompanyFromSearchResult, DuplicateCompanyError } from "@/modules/companies/companies.service";
import {
  BusinessSearchQueryTooBroadError,
  getBusinessDataProvider,
  ProviderNotConfiguredError,
  type BusinessSearchResultItem,
} from "@/modules/companies/providers/business-data-provider";
import { resolveSegmentToCnae } from "@/modules/companies/providers/cnae-resolver";
import { getWebPresenceChecker } from "@/modules/companies/presence/get-web-presence-checker";

export interface SearchResultView {
  searchResultId: string;
  name: string;
  category?: string;
  address?: string;
  phone?: string;
  attributionLabel: string;
  alreadyConverted: boolean;
}

export interface SearchActionResult {
  success: boolean;
  message?: string;
  providerNotConfigured?: boolean;
  results?: SearchResultView[];
  resolvedSegmentLabel?: string | null;
}

function buildAttributionLabel(attribution: Record<string, unknown>): string {
  const source = typeof attribution.source === "string" ? attribution.source : undefined;
  const via = typeof attribution.via === "string" ? attribution.via : undefined;
  if (source && via) return `Dados: ${source} (via ${via})`;
  return source ?? via ?? "Dados de provedor externo";
}

/**
 * Registra a intenção de busca (`searches`), resolve o segmento em
 * texto livre para CNAE (quando possível) e executa a busca via o
 * `BusinessDataProvider` configurado. Os resultados são salvos em
 * `search_results` (nunca criando `companies` automaticamente — a
 * conversão é uma ação explícita do usuário, ver
 * `convertSearchResultToCompanyAction`), para que uma busca cara nunca
 * se perca se o usuário recarregar a página antes de decidir o que
 * importar.
 */
export async function searchCompaniesAction(
  _prev: SearchActionResult,
  formData: FormData,
): Promise<SearchActionResult> {
  const query = formData.get("query");
  if (typeof query !== "string" || query.trim().length < 2) {
    return { success: false, message: "Informe o que você está buscando (ex.: 'restaurantes')." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Sessão expirada. Faça login novamente." };

  try {
    await assertCanEditOrganization(supabase, organizationId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    throw error;
  }

  const segment = formData.get("segment");
  const state = formData.get("state");
  const city = formData.get("city");

  const segmentText = typeof segment === "string" ? segment : undefined;
  const stateText = typeof state === "string" && state.trim().length > 0 ? state.trim() : undefined;
  const cityText = typeof city === "string" && city.trim().length > 0 ? city.trim() : undefined;

  const { data: search, error: insertError } = await supabase
    .from("searches")
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      query: query.trim(),
      segment: segmentText && segmentText.length > 0 ? segmentText : null,
      state: stateText?.toUpperCase() ?? null,
      city: cityText ?? null,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !search) {
    return { success: false, message: "Não foi possível registrar a busca." };
  }

  const segmentResolution = await resolveSegmentToCnae(supabase, organizationId, {
    segment: segmentText,
    query: query.trim(),
  });

  try {
    const provider = getBusinessDataProvider();
    const page = await provider.search({
      query: query.trim(),
      segment: segmentText,
      state: stateText,
      city: cityText,
      cnaeCodes: segmentResolution.cnaeCodes.length > 0 ? segmentResolution.cnaeCodes : undefined,
    });

    const resultViews: SearchResultView[] = [];

    for (const item of page.items) {
      const { data: resultRow, error: resultError } = await supabase
        .from("search_results")
        .insert({
          organization_id: organizationId,
          search_id: search.id,
          provider: item.provider,
          external_id: item.externalId,
          display_data: buildDisplayData(item) as Json,
          attribution: item.attribution as Json,
          fetched_at: item.fetchedAt,
          expires_at: item.expiresAt ?? null,
        })
        .select("id")
        .single();

      if (resultError || !resultRow) {
        logger.error("Falha ao persistir resultado de busca", {
          error: resultError?.message,
          organizationId,
          searchId: search.id,
        });
        continue;
      }

      resultViews.push({
        searchResultId: resultRow.id,
        name: item.name,
        category: item.category,
        address: item.address,
        phone: item.phone,
        attributionLabel: buildAttributionLabel(item.attribution),
        alreadyConverted: false,
      });
    }

    await supabase
      .from("searches")
      .update({
        status: "completed",
        total_results: resultViews.length,
        providers: [provider.name],
        completed_at: new Date().toISOString(),
      })
      .eq("id", search.id);

    return { success: true, results: resultViews, resolvedSegmentLabel: segmentResolution.matchedLabel };
  } catch (error) {
    await supabase.from("searches").update({ status: "failed" }).eq("id", search.id);

    if (error instanceof ProviderNotConfiguredError) {
      return { success: false, providerNotConfigured: true, message: error.message };
    }
    if (error instanceof BusinessSearchQueryTooBroadError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Não foi possível buscar empresas agora." };
  }
}

function buildDisplayData(item: BusinessSearchResultItem): Record<string, unknown> {
  return {
    name: item.name,
    category: item.category,
    address: item.address,
    phone: item.phone,
    website: item.website,
    raw: item.displayData,
  };
}

export interface ConvertResultActionState {
  success: boolean;
  message?: string;
  companyId?: string;
}

/**
 * Converte um `search_results` já salvo em uma empresa cadastrada
 * (ver `createCompanyFromSearchResult`). Nunca mescla automaticamente
 * com uma empresa parecida — a mesma política conservadora do CSV.
 */
export async function convertSearchResultToCompanyAction(
  searchResultId: string,
): Promise<ConvertResultActionState> {
  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    throw error;
  }

  const { data: resultRow, error: fetchError } = await supabase
    .from("search_results")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", searchResultId)
    .maybeSingle();

  if (fetchError || !resultRow) {
    return { success: false, message: "Resultado de busca não encontrado." };
  }

  if (resultRow.company_id) {
    return { success: false, message: "Este resultado já foi convertido em empresa." };
  }

  const displayData = (resultRow.display_data ?? {}) as Record<string, unknown>;
  const raw = (displayData.raw ?? {}) as Record<string, unknown>;

  try {
    const company = await createCompanyFromSearchResult(
      supabase,
      organizationId,
      {
        name: typeof displayData.name === "string" ? displayData.name : "(sem nome)",
        cnpj: resultRow.external_id,
        category: typeof displayData.category === "string" ? displayData.category : undefined,
        website: typeof displayData.website === "string" ? displayData.website : undefined,
        phone: typeof displayData.phone === "string" ? displayData.phone : undefined,
        email: typeof raw.email === "string" ? raw.email : undefined,
        city: typeof raw.municipio === "string" ? raw.municipio : undefined,
        state: typeof raw.uf === "string" ? raw.uf : undefined,
      },
      {
        provider: resultRow.provider,
        externalId: resultRow.external_id ?? "",
        attribution: (resultRow.attribution ?? {}) as Record<string, unknown>,
        fetchedAt: resultRow.fetched_at,
      },
    );

    await supabase.from("search_results").update({ company_id: company.id }).eq("id", resultRow.id);

    return { success: true, companyId: company.id };
  } catch (error) {
    if (error instanceof DuplicateCompanyError) {
      return { success: false, message: error.message };
    }
    logger.error("Falha ao converter resultado de busca em empresa", {
      error: error instanceof Error ? error.message : "erro desconhecido",
      organizationId,
      searchResultId,
    });
    return { success: false, message: "Não foi possível cadastrar esta empresa agora." };
  }
}

export interface CheckWebPresenceActionState {
  success: boolean;
  message?: string;
  checkerNotConfigured?: boolean;
  hasWebsite?: boolean;
  websiteUrl?: string;
}

/**
 * Verifica (via `WebPresenceChecker`, ver `modules/companies/presence/`)
 * se a empresa de um resultado de busca aparenta ter site próprio — o
 * sinal central de prospecção do FinderFlow AI. Ação manual por
 * resultado, de propósito: cada chamada consome a cota da API de busca
 * usada, então nunca é disparada automaticamente para uma lista inteira
 * (ver o comentário em `brave-web-presence-checker.ts`).
 */
export async function checkWebPresenceAction(searchResultId: string): Promise<CheckWebPresenceActionState> {
  const checker = getWebPresenceChecker();
  if (!checker) {
    return {
      success: false,
      checkerNotConfigured: true,
      message: "Verificação de presença digital não configurada (defina BRAVE_SEARCH_API_KEY).",
    };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  const { data: resultRow, error: fetchError } = await supabase
    .from("search_results")
    .select("display_data")
    .eq("organization_id", organizationId)
    .eq("id", searchResultId)
    .maybeSingle();

  if (fetchError || !resultRow) {
    return { success: false, message: "Resultado de busca não encontrado." };
  }

  const displayData = (resultRow.display_data ?? {}) as Record<string, unknown>;
  const raw = (displayData.raw ?? {}) as Record<string, unknown>;
  const companyName = typeof displayData.name === "string" ? displayData.name : null;
  if (!companyName) {
    return { success: false, message: "Este resultado não tem nome suficiente para verificar." };
  }

  try {
    const presence = await checker.check({
      companyName,
      city: typeof raw.municipio === "string" ? raw.municipio : undefined,
      state: typeof raw.uf === "string" ? raw.uf : undefined,
    });

    await supabase
      .from("search_results")
      .update({ display_data: { ...displayData, webPresence: presence } as unknown as Json })
      .eq("id", searchResultId);

    return { success: true, hasWebsite: presence.hasWebsite, websiteUrl: presence.websiteUrl };
  } catch (error) {
    logger.error("Falha ao verificar presença digital", {
      error: error instanceof Error ? error.message : "erro desconhecido",
      organizationId,
      searchResultId,
    });
    return { success: false, message: "Não foi possível verificar a presença digital agora." };
  }
}
