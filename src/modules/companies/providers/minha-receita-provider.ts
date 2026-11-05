import "server-only";

import { logger } from "@/lib/logger/logger";

import {
  BusinessSearchQueryTooBroadError,
  type BusinessDataProvider,
  type BusinessSearchPage,
  type BusinessSearchQuery,
  type BusinessSearchResultItem,
} from "./business-data-provider";

/**
 * Adaptador para a API pública do Minha Receita (minhareceita.org),
 * que serve a base de CNPJ da Receita Federal "tal como publicada"
 * (ver docs.minhareceita.org/sobre-os-dados). Validação feita antes de
 * integrar (docs/DECISIONS.md): dado oficial do governo, código MIT,
 * sem cobrança, mas também sem SLA formal — é mantido voluntariamente.
 * Por isso este adaptador trata timeouts/5xx/429 como falhas normais
 * (com um retry simples), nunca como bug do nosso lado.
 *
 * A busca paginada (`GET /?uf=..&cnae=..`) é documentada pelo próprio
 * projeto como "em fase de testes" — os parâmetros podem mudar. Isolar
 * isso neste único arquivo é exatamente o propósito do contrato
 * `BusinessDataProvider`: se a API mudar ou se decidirmos auto-hospedar
 * uma instância própria (`BUSINESS_PROVIDER_BASE_URL`), só este arquivo
 * muda.
 */

const MAX_RESULTS_PER_SEARCH = 60;
const PAGE_LIMIT = 50;
const MAX_PAGES_FOLLOWED = 4;
const REQUEST_TIMEOUT_MS = 12_000;

interface MinhaReceitaSocio {
  nome_socio?: string;
}

interface MinhaReceitaCompany {
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string | null;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  descricao_tipo_de_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
  email?: string | null;
  descricao_situacao_cadastral?: string;
  qsa?: MinhaReceitaSocio[];
}

interface MinhaReceitaSearchResponse {
  data: MinhaReceitaCompany[];
  cursor?: string;
}

/** Estado interno de paginação, codificado em base64 no `pageToken` opaco exposto ao resto do app. */
interface PageState {
  upstreamCursor?: string;
  cityFilter?: string;
}

function encodePageToken(state: PageState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function decodePageToken(token: string | undefined): PageState {
  if (!token) return {};
  try {
    return JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as PageState;
  } catch {
    return {};
  }
}

function normalizeForCompare(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function buildAddress(company: MinhaReceitaCompany): string | undefined {
  const parts = [
    [company.descricao_tipo_de_logradouro, company.logradouro].filter(Boolean).join(" "),
    company.numero,
    company.complemento,
    company.bairro,
    company.municipio && company.uf ? `${company.municipio} - ${company.uf}` : company.municipio ?? company.uf,
    company.cep,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));

  return parts.length > 0 ? parts.join(", ") : undefined;
}

function mapToResultItem(company: MinhaReceitaCompany): BusinessSearchResultItem {
  const now = new Date().toISOString();
  return {
    externalId: company.cnpj,
    provider: "minha_receita",
    name: company.nome_fantasia?.trim() || company.razao_social || company.cnpj,
    category: company.cnae_fiscal_descricao,
    address: buildAddress(company),
    phone: company.ddd_telefone_1 || undefined,
    website: undefined, // a Receita não tem este campo — ver limitação documentada em business-data-provider.ts
    displayData: {
      razaoSocial: company.razao_social,
      nomeFantasia: company.nome_fantasia,
      cnaeFiscal: company.cnae_fiscal,
      cnaeFiscalDescricao: company.cnae_fiscal_descricao,
      situacaoCadastral: company.descricao_situacao_cadastral,
      municipio: company.municipio,
      uf: company.uf,
      email: company.email ?? undefined,
      socios: (company.qsa ?? []).map((socio) => socio.nome_socio).filter(Boolean),
    },
    attribution: {
      source: "Receita Federal do Brasil — dados abertos de CNPJ",
      via: "Minha Receita (minhareceita.org)",
      url: "https://minhareceita.org",
      license: "Dado público oficial servido como publicado; código do Minha Receita é MIT.",
    },
    fetchedAt: now,
  };
}

async function fetchPage(
  baseUrl: string,
  params: URLSearchParams,
  attempt = 1,
): Promise<MinhaReceitaSearchResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/?${params.toString()}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        return fetchPage(baseUrl, params, attempt + 1);
      }
      throw new Error(`Minha Receita respondeu ${response.status} após retry.`);
    }

    if (!response.ok) {
      throw new Error(`Minha Receita respondeu ${response.status}.`);
    }

    return (await response.json()) as MinhaReceitaSearchResponse;
  } finally {
    clearTimeout(timeout);
  }
}

export class MinhaReceitaProvider implements BusinessDataProvider {
  readonly name = "minha_receita";

  constructor(private readonly baseUrl: string) {}

  async search(query: BusinessSearchQuery): Promise<BusinessSearchPage> {
    const state = decodePageToken(query.pageToken);
    const cityFilter = state.cityFilter ?? (query.city ? normalizeForCompare(query.city) : undefined);
    const hasCnae = Boolean(query.cnaeCodes && query.cnaeCodes.length > 0);
    const hasState = Boolean(query.state && query.state.trim().length > 0);

    if (!hasCnae && !hasState && !state.upstreamCursor) {
      throw new BusinessSearchQueryTooBroadError();
    }

    const collected: BusinessSearchResultItem[] = [];
    let cursor = state.upstreamCursor;
    let pagesFollowed = 0;

    while (collected.length < MAX_RESULTS_PER_SEARCH && pagesFollowed < MAX_PAGES_FOLLOWED) {
      const params = new URLSearchParams();
      if (query.cnaeCodes) for (const code of query.cnaeCodes) params.append("cnae", code);
      if (hasState) params.set("uf", query.state!.trim().toUpperCase());
      params.set("limit", String(PAGE_LIMIT));
      if (cursor) params.set("cursor", cursor);

      let page: MinhaReceitaSearchResponse;
      try {
        page = await fetchPage(this.baseUrl, params);
      } catch (error) {
        logger.error("Falha ao consultar o Minha Receita", {
          provider: this.name,
          error: error instanceof Error ? error.message : "erro desconhecido",
        });
        throw new Error(
          "Não foi possível buscar empresas agora (provedor de dados públicos de CNPJ indisponível). Tente novamente em alguns minutos.",
        );
      }

      pagesFollowed += 1;
      cursor = page.cursor;

      for (const company of page.data ?? []) {
        if (cityFilter && normalizeForCompare(company.municipio ?? "") !== cityFilter) continue;
        collected.push(mapToResultItem(company));
        if (collected.length >= MAX_RESULTS_PER_SEARCH) break;
      }

      if (!cursor) break; // última página do provedor
    }

    const hasMore = Boolean(cursor) && collected.length >= MAX_RESULTS_PER_SEARCH;

    return {
      items: collected,
      nextPageToken: hasMore ? encodePageToken({ upstreamCursor: cursor, cityFilter }) : undefined,
    };
  }
}
