"use server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger/logger";
import type { Json } from "@/types/database";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import {
  CompanyAlreadyConvertedError,
  convertCompanyToLead,
  createCompanyFromSearchResult,
  DuplicateCompanyError,
  getActiveLeadIdForCompany,
} from "@/modules/companies/companies.service";
import {
  BusinessProviderUnavailableError,
  BusinessSearchQueryTooBroadError,
  getBusinessDataProvider,
  ProviderNotConfiguredError,
  type BusinessSearchResultItem,
} from "@/modules/companies/providers/business-data-provider";
import { resolveSegmentToCnae } from "@/modules/companies/providers/cnae-resolver";
import {
  getWebPresenceChecker,
  isBulkPresenceCheckAllowed,
} from "@/modules/companies/presence/get-web-presence-checker";
import type { WebPresenceChecker } from "@/modules/companies/presence/web-presence-checker";
import { formatCnpj, isValidCnpj, normalizeDocument } from "@/lib/utils/normalize";
import { formatDateTime } from "@/lib/utils/format";

import { getSearchWithResults, listSearchHistory } from "./history.service";
import { PRESENCE_BATCH_MAX } from "./constants";
import { buildAttributionLabel } from "./shared";

export interface SearchResultView {
  searchResultId: string;
  name: string;
  category?: string;
  address?: string;
  phone?: string;
  attributionLabel: string;
  alreadyConverted: boolean;
  /**
   * Presença digital já verificada e salva anteriormente (ver
   * `checkWebPresenceAction`, que persiste em `display_data.webPresence`).
   * Permite à UI mostrar o resultado já conhecido sem precisar clicar em
   * "Verificar site" de novo — sobretudo importante ao reabrir uma busca
   * do histórico (`history.service.ts`).
   */
  cachedWebPresence?: { hasWebsite: boolean; websiteUrl?: string };
}

export interface SearchActionResult {
  success: boolean;
  message?: string;
  providerNotConfigured?: boolean;
  results?: SearchResultView[];
  resolvedSegmentLabel?: string | null;
  /** Aviso não bloqueante exibido junto dos resultados (ex.: dados vindos de uma consulta anterior). */
  notice?: string;
  /** Para montar o link de exportação em XLSX (`/api/v1/search-results/:searchId/export`) sem nova busca. */
  searchId?: string;
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

    return {
      success: true,
      results: resultViews,
      resolvedSegmentLabel: segmentResolution.matchedLabel,
      searchId: search.id,
      notice:
        page.cache?.state === "stale"
          ? `O provedor de dados está indisponível agora — estes são os resultados da última consulta igual a esta, feita em ${formatDateTime(page.cache.fetchedAt)}.`
          : page.partial
            ? "O provedor de dados parou de responder no meio da busca — a lista abaixo pode estar incompleta. Tente de novo em alguns minutos para ver o restante."
            : undefined,
    };
  } catch (error) {
    await supabase.from("searches").update({ status: "failed" }).eq("id", search.id);

    if (error instanceof ProviderNotConfiguredError) {
      return { success: false, providerNotConfigured: true, message: error.message };
    }
    if (error instanceof BusinessSearchQueryTooBroadError || error instanceof BusinessProviderUnavailableError) {
      return { success: false, message: error.message };
    }
    logger.error("Falha inesperada na busca de empresas", {
      error: error instanceof Error ? error.message : "erro desconhecido",
      organizationId,
      searchId: search.id,
    });
    return { success: false, message: "Não foi possível buscar empresas agora." };
  }
}

/**
 * Busca uma empresa específica por CNPJ (consulta direta, diferente da
 * busca por segmento/UF) — pedido explícito do usuário. Mesmo
 * tratamento de persistência da busca por segmento (`searches` +
 * `search_results`), então entra automaticamente no histórico e pode
 * ser exportada em XLSX como qualquer outra busca.
 */
export async function searchByCnpjAction(
  _prev: SearchActionResult,
  formData: FormData,
): Promise<SearchActionResult> {
  const cnpjInput = formData.get("cnpj");
  if (typeof cnpjInput !== "string" || cnpjInput.trim().length === 0) {
    return { success: false, message: "Informe um CNPJ." };
  }

  if (!isValidCnpj(cnpjInput)) {
    return { success: false, message: "CNPJ inválido — confira os números e o dígito verificador." };
  }

  const digits = normalizeDocument(cnpjInput)!;
  const formatted = formatCnpj(digits) ?? digits;

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

  const { data: search, error: insertError } = await supabase
    .from("searches")
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      query: `CNPJ ${formatted}`,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !search) {
    return { success: false, message: "Não foi possível registrar a busca." };
  }

  try {
    const provider = getBusinessDataProvider();
    if (!provider.getByCnpj) {
      await supabase.from("searches").update({ status: "failed" }).eq("id", search.id);
      return {
        success: false,
        message: "O provedor de dados de empresas configurado não suporta consulta direta por CNPJ.",
      };
    }

    const item = await provider.getByCnpj(digits);

    if (!item) {
      await supabase
        .from("searches")
        .update({ status: "completed", total_results: 0, providers: [provider.name], completed_at: new Date().toISOString() })
        .eq("id", search.id);
      return { success: true, results: [], searchId: search.id };
    }

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

    await supabase
      .from("searches")
      .update({
        status: "completed",
        total_results: resultRow ? 1 : 0,
        providers: [provider.name],
        completed_at: new Date().toISOString(),
      })
      .eq("id", search.id);

    if (resultError || !resultRow) {
      logger.error("Falha ao persistir resultado de busca por CNPJ", {
        error: resultError?.message,
        organizationId,
        searchId: search.id,
      });
      return { success: false, message: "Empresa encontrada, mas não foi possível salvar o resultado." };
    }

    return {
      success: true,
      searchId: search.id,
      results: [
        {
          searchResultId: resultRow.id,
          name: item.name,
          category: item.category,
          address: item.address,
          phone: item.phone,
          attributionLabel: buildAttributionLabel(item.attribution),
          alreadyConverted: false,
        },
      ],
    };
  } catch (error) {
    await supabase.from("searches").update({ status: "failed" }).eq("id", search.id);

    if (error instanceof ProviderNotConfiguredError) {
      return { success: false, providerNotConfigured: true, message: error.message };
    }
    if (error instanceof BusinessProviderUnavailableError) {
      return { success: false, message: error.message };
    }
    logger.error("Falha ao buscar empresa por CNPJ", {
      error: error instanceof Error ? error.message : "erro desconhecido",
      organizationId,
      searchId: search.id,
    });
    return { success: false, message: "Não foi possível buscar este CNPJ agora." };
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

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ConvertOutcome = { ok: true; companyId: string } | { ok: false; message: string };

/**
 * Cria a empresa a partir de um `search_results` já salvo (ou devolve a
 * empresa já criada, se o resultado já tinha sido convertido). Nunca
 * mescla automaticamente com uma empresa parecida — a mesma política
 * conservadora do CSV.
 */
async function ensureCompanyForSearchResult(
  supabase: Supabase,
  organizationId: string,
  searchResultId: string,
  options: { reuseExisting: boolean },
): Promise<ConvertOutcome> {
  const { data: resultRow, error: fetchError } = await supabase
    .from("search_results")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", searchResultId)
    .maybeSingle();

  if (fetchError || !resultRow) {
    return { ok: false, message: "Resultado de busca não encontrado." };
  }

  if (resultRow.company_id) {
    return options.reuseExisting
      ? { ok: true, companyId: resultRow.company_id }
      : { ok: false, message: "Este resultado já foi convertido em empresa." };
  }

  const displayData = (resultRow.display_data ?? {}) as Record<string, unknown>;
  const raw = (displayData.raw ?? {}) as Record<string, unknown>;
  // Se "Verificar site" já achou um site para este resultado, ele vai
  // junto no cadastro — o provedor de CNPJ nunca traz esse campo.
  const webPresence = (displayData.webPresence ?? {}) as Record<string, unknown>;
  const website =
    typeof displayData.website === "string"
      ? displayData.website
      : webPresence.hasWebsite === true && typeof webPresence.websiteUrl === "string"
        ? webPresence.websiteUrl
        : undefined;

  try {
    const company = await createCompanyFromSearchResult(
      supabase,
      organizationId,
      {
        name: typeof displayData.name === "string" ? displayData.name : "(sem nome)",
        cnpj: resultRow.external_id,
        category: typeof displayData.category === "string" ? displayData.category : undefined,
        website,
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

    return { ok: true, companyId: company.id };
  } catch (error) {
    if (error instanceof DuplicateCompanyError) {
      return { ok: false, message: error.message };
    }
    logger.error("Falha ao converter resultado de busca em empresa", {
      error: error instanceof Error ? error.message : "erro desconhecido",
      organizationId,
      searchResultId,
    });
    return { ok: false, message: "Não foi possível cadastrar esta empresa agora." };
  }
}

/** Converte um resultado de busca em empresa cadastrada (ver `ensureCompanyForSearchResult`). */
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

  const outcome = await ensureCompanyForSearchResult(supabase, organizationId, searchResultId, {
    reuseExisting: false,
  });
  return outcome.ok ? { success: true, companyId: outcome.companyId } : { success: false, message: outcome.message };
}

export interface ConvertResultToLeadActionState {
  success: boolean;
  message?: string;
  companyId?: string;
  leadId?: string;
}

/**
 * Atalho de triagem: cadastra a empresa (se ainda não foi) e já cria o
 * lead na primeira etapa do pipeline — antes eram duas telas e dois
 * cliques por empresa. Se a empresa já tiver um lead ativo, devolve esse
 * lead em vez de falhar.
 */
export async function convertSearchResultToLeadAction(
  searchResultId: string,
): Promise<ConvertResultToLeadActionState> {
  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    throw error;
  }

  const outcome = await ensureCompanyForSearchResult(supabase, organizationId, searchResultId, {
    reuseExisting: true,
  });
  if (!outcome.ok) return { success: false, message: outcome.message };

  try {
    const leadId = await convertCompanyToLead(supabase, organizationId, outcome.companyId);
    return { success: true, companyId: outcome.companyId, leadId };
  } catch (error) {
    if (error instanceof CompanyAlreadyConvertedError) {
      const existingLeadId = await getActiveLeadIdForCompany(supabase, organizationId, outcome.companyId);
      return { success: true, companyId: outcome.companyId, leadId: existingLeadId ?? undefined };
    }
    logger.error("Falha ao criar lead a partir de resultado de busca", {
      error: error instanceof Error ? error.message : "erro desconhecido",
      organizationId,
      searchResultId,
    });
    return {
      success: false,
      companyId: outcome.companyId,
      message: "A empresa foi cadastrada, mas não foi possível criar o lead agora.",
    };
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
 * Verifica um resultado e grava o achado em `display_data.webPresence`.
 * Compartilhado pela ação individual e pela verificação em lote.
 */
async function runPresenceCheck(
  supabase: Supabase,
  organizationId: string,
  checker: WebPresenceChecker,
  searchResultId: string,
): Promise<CheckWebPresenceActionState> {
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
      .eq("organization_id", organizationId)
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

/**
 * Verifica (via `WebPresenceChecker`, ver `modules/companies/presence/`)
 * se a empresa de um resultado de busca aparenta ter site próprio — o
 * sinal central de prospecção do FinderFlow AI.
 */
export async function checkWebPresenceAction(searchResultId: string): Promise<CheckWebPresenceActionState> {
  const checker = getWebPresenceChecker();
  if (!checker) {
    return {
      success: false,
      checkerNotConfigured: true,
      message: "Verificação de presença digital indisponível neste ambiente.",
    };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();
  return runPresenceCheck(supabase, organizationId, checker, searchResultId);
}

export interface CheckWebPresenceBatchActionState {
  success: boolean;
  message?: string;
  /** Um item por id recebido, na mesma ordem. */
  outcomes?: Array<CheckWebPresenceActionState & { searchResultId: string }>;
}

/**
 * Verificação em lote ("Verificar site de todos"): até
 * `PRESENCE_BATCH_MAX` resultados por chamada, em paralelo no servidor —
 * o cliente manda a lista em pedaços e mostra o progresso.
 *
 * Só é permitida com o verificador por domínio (padrão, sem cota). Com a
 * Brave Search configurada cada verificação gasta a cota mensal da chave,
 * então lá continua valendo o clique manual por resultado.
 */
export async function checkWebPresenceBatchAction(
  searchResultIds: string[],
): Promise<CheckWebPresenceBatchActionState> {
  if (!isBulkPresenceCheckAllowed()) {
    return {
      success: false,
      message: "A verificação em lote não está disponível com o verificador configurado neste ambiente.",
    };
  }

  if (
    !Array.isArray(searchResultIds) ||
    searchResultIds.length === 0 ||
    searchResultIds.length > PRESENCE_BATCH_MAX ||
    searchResultIds.some((id) => typeof id !== "string" || id.length === 0)
  ) {
    return { success: false, message: "Lote de verificação inválido." };
  }

  const checker = getWebPresenceChecker();
  if (!checker) {
    return { success: false, message: "Verificação de presença digital indisponível neste ambiente." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  const outcomes = await Promise.all(
    searchResultIds.map(async (searchResultId) => ({
      searchResultId,
      ...(await runPresenceCheck(supabase, organizationId, checker, searchResultId)),
    })),
  );

  return { success: true, outcomes };
}

export interface SearchHistoryEntryView {
  searchId: string;
  query: string;
  segment: string | null;
  city: string | null;
  state: string | null;
  status: string;
  totalResults: number;
  createdAt: string;
}

export interface SearchHistoryActionResult {
  success: boolean;
  message?: string;
  entries?: SearchHistoryEntryView[];
  page?: number;
  pageSize?: number;
  total?: number;
}

/** Lista as buscas já feitas pela organização — nunca consulta o provedor externo. */
export async function listSearchHistoryAction(page = 1): Promise<SearchHistoryActionResult> {
  const supabase = await createClient();

  try {
    const { organizationId } = await requireActiveOrganization();
    const { searches, total, pageSize } = await listSearchHistory(supabase, organizationId, page);

    return {
      success: true,
      page,
      pageSize,
      total,
      entries: searches.map((row) => ({
        searchId: row.id,
        query: row.query,
        segment: row.segment,
        city: row.city,
        state: row.state,
        status: row.status,
        totalResults: row.total_results,
        createdAt: row.created_at,
      })),
    };
  } catch (error) {
    logger.error("Falha ao listar histórico de buscas", {
      error: error instanceof Error ? error.message : "erro desconhecido",
    });
    return { success: false, message: "Não foi possível carregar o histórico de buscas." };
  }
}

export interface ReopenSearchActionResult {
  success: boolean;
  message?: string;
  entry?: SearchHistoryEntryView;
  results?: SearchResultView[];
}

/**
 * Reabre uma busca do histórico: devolve os resultados exatamente como
 * foram salvos na hora, **sem gastar nenhuma requisição nova ao
 * provedor** — o pedido explícito do usuário ("voltar para última
 * busca sem precisar realizar uma nova, gastando requisições").
 */
export async function reopenSearchAction(searchId: string): Promise<ReopenSearchActionResult> {
  const supabase = await createClient();

  try {
    const { organizationId } = await requireActiveOrganization();
    const found = await getSearchWithResults(supabase, organizationId, searchId);

    if (!found) {
      return { success: false, message: "Busca não encontrada." };
    }

    return {
      success: true,
      entry: {
        searchId: found.search.id,
        query: found.search.query,
        segment: found.search.segment,
        city: found.search.city,
        state: found.search.state,
        status: found.search.status,
        totalResults: found.search.total_results,
        createdAt: found.search.created_at,
      },
      results: found.results,
    };
  } catch (error) {
    logger.error("Falha ao reabrir busca do histórico", {
      error: error instanceof Error ? error.message : "erro desconhecido",
      searchId,
    });
    return { success: false, message: "Não foi possível carregar esta busca." };
  }
}
