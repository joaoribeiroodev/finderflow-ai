import "server-only";

import { logger } from "@/lib/logger/logger";
import { normalizeCompanyName } from "@/lib/utils/normalize";

import { extractRegistrableDomain, isNonOwnedDomain } from "./non-owned-domains";
import type { WebPresenceChecker, WebPresenceQuery, WebPresenceResult } from "./web-presence-checker";

/**
 * Verifica presença de site via a Brave Search API (web search), que
 * tem uso comercial/automatizado explicitamente permitido no plano
 * pago (e um nível gratuito de 2.000 requisições/mês) — ao contrário
 * de raspar a página de resultados do Google, que violaria os Termos
 * de Uso do Google. Ver docs/DECISIONS.md para a comparação completa
 * de alternativas (Bing Search API foi descontinuada em ago/2025; a
 * Google Custom Search JSON API está fechada para novos clientes).
 *
 * **Isto é um indício, não uma certeza.** Uma empresa pode ter site e
 * não aparecer bem indexada para o nome usado na busca (nome fantasia
 * diferente da razão social, nome genérico demais, site muito novo),
 * e o inverso (aparecer um resultado de nome parecido que não é a
 * mesma empresa). Por isso a UI mostra "sem site identificado", nunca
 * "não tem site" — e por isso isto é um passo manual (botão "Verificar
 * site" por resultado), não automático para toda busca: cada chamada
 * consome a cota da API, e automatizar para todos os resultados de
 * toda busca esgotaria o nível gratuito em poucas buscas.
 */

const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const REQUEST_TIMEOUT_MS = 10_000;
const RESULTS_TO_INSPECT = 5;
/** Jaccard mínimo entre os tokens do nome da empresa e do domínio candidato para considerar "é o site dela". */
const MIN_NAME_OVERLAP = 0.4;

interface BraveSearchResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveSearchResponse {
  web?: { results?: BraveSearchResult[] };
}

function tokensOf(value: string): Set<string> {
  return new Set(normalizeCompanyName(value).split(" ").filter((token) => token.length > 2));
}

function nameOverlap(companyName: string, candidate: string): number {
  const companyTokens = tokensOf(companyName);
  const candidateTokens = tokensOf(candidate);
  if (companyTokens.size === 0 || candidateTokens.size === 0) return 0;

  let shared = 0;
  for (const token of companyTokens) {
    if (candidateTokens.has(token)) shared += 1;
  }
  return shared / companyTokens.size;
}

export class BraveWebPresenceChecker implements WebPresenceChecker {
  readonly name = "brave_search";

  constructor(private readonly apiKey: string) {}

  async check(query: WebPresenceQuery): Promise<WebPresenceResult> {
    const searchText = [query.companyName, query.city, query.state].filter(Boolean).join(" ");
    const now = new Date().toISOString();

    const url = new URL(BRAVE_SEARCH_ENDPOINT);
    url.searchParams.set("q", searchText);
    url.searchParams.set("count", String(RESULTS_TO_INSPECT));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: "application/json", "x-subscription-token": this.apiKey },
      });
    } catch (error) {
      clearTimeout(timeout);
      logger.error("Falha ao consultar a Brave Search API", {
        error: error instanceof Error ? error.message : "erro desconhecido",
      });
      throw new Error("Não foi possível verificar a presença digital agora. Tente novamente em alguns minutos.");
    }
    clearTimeout(timeout);

    if (!response.ok) {
      logger.error("Brave Search API respondeu com erro", { status: response.status });
      throw new Error("Não foi possível verificar a presença digital agora. Tente novamente em alguns minutos.");
    }

    const body = (await response.json()) as BraveSearchResponse;
    const results = body.web?.results ?? [];

    for (const result of results) {
      if (!result.url || isNonOwnedDomain(result.url)) continue;

      const candidateDomain = extractRegistrableDomain(new URL(result.url).hostname);
      const overlap = Math.max(
        nameOverlap(query.companyName, candidateDomain),
        nameOverlap(query.companyName, result.title ?? ""),
      );

      if (overlap >= MIN_NAME_OVERLAP) {
        return { hasWebsite: true, websiteUrl: result.url, checkedVia: this.name, checkedAt: now };
      }
    }

    return { hasWebsite: false, checkedVia: this.name, checkedAt: now };
  }
}
