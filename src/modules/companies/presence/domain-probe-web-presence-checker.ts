import "server-only";

import { logger } from "@/lib/logger/logger";

import { generateDomainCandidates } from "./domain-candidates";
import type { WebPresenceChecker, WebPresenceQuery, WebPresenceResult } from "./web-presence-checker";

/**
 * Verifica presença de site **sem nenhuma API de busca**: gera domínios
 * candidatos a partir do nome da empresa (`domain-candidates.ts`) e
 * faz uma requisição HTTP direta a cada um para ver se resolve a um
 * site real. Nenhum motor de busca ou mapa é consultado — por isso
 * não há Termos de Uso de terceiro envolvidos (ver docs/DECISIONS.md:
 * scraping do Google Maps/Search foi avaliado e recusado por violar
 * os ToS deles; isto aqui é diferente — é apenas visitar URLs que nós
 * mesmos construímos, igual um navegador faria).
 *
 * Escolhido como verificador **padrão** (não precisa de nenhuma
 * variável de ambiente) depois que a Brave Search API — usada antes —
 * foi reavaliada nesta sessão e confirmada como exigindo cartão de
 * crédito no cadastro mesmo para o nível gratuito, o que o usuário
 * explicitamente não quer usar. `BraveWebPresenceChecker` continua no
 * código como upgrade opcional (melhor recall, custa requisições de
 * uma API paga) para quem configurar `BRAVE_SEARCH_API_KEY` por conta
 * própria — ver `get-web-presence-checker.ts`.
 *
 * **Isto é um indício, não uma certeza — e tem recall bem mais baixo
 * que uma busca real.** Só encontra o site se o domínio seguir um
 * padrão previsível a partir do nome da empresa (ex.: "Padaria Bela
 * Vista" -> padariabelavista.com.br). Não encontra sites com domínio
 * fora desse padrão (ex.: um nome de marca diferente da razão social).
 * Por isso a UI mostra "sem site identificado", nunca "não tem site".
 */

const REQUEST_TIMEOUT_MS = 6_000;
const MAX_CANDIDATES_TO_TRY = 12;
/** Corpo HTML menor que isto é tratado como "provavelmente não é um site de verdade" (página de erro/estacionada minúscula). */
const MIN_PLAUSIBLE_BODY_LENGTH = 200;

/** Textos comuns em páginas de "domínio à venda"/estacionado — presentes mesmo quando o servidor responde 200. */
const PARKING_PAGE_MARKERS = [
  "domain is for sale",
  "domínio está à venda",
  "dominio esta a venda",
  "buy this domain",
  "this domain may be for sale",
  "parked free",
  "godaddy.com/domains",
  "hugedomains.com",
  "sedo.com",
  "registrar.com",
  "future home of something quite cool",
];

function looksLikeParkingPage(html: string): boolean {
  const lower = html.toLowerCase();
  if (html.length < MIN_PLAUSIBLE_BODY_LENGTH) return true;
  return PARKING_PAGE_MARKERS.some((marker) => lower.includes(marker));
}

async function probeCandidate(url: string): Promise<{ ok: boolean; finalUrl: string; html?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; FinderFlowAI/1.0; +https://finderflow.ai)",
      },
    });

    if (!response.ok) return { ok: false, finalUrl: url };

    const html = await response.text();
    if (looksLikeParkingPage(html)) return { ok: false, finalUrl: response.url || url };

    return { ok: true, finalUrl: response.url || url, html };
  } catch {
    return { ok: false, finalUrl: url };
  } finally {
    clearTimeout(timeout);
  }
}

export class DomainProbeWebPresenceChecker implements WebPresenceChecker {
  readonly name = "domain_probe";

  async check(query: WebPresenceQuery): Promise<WebPresenceResult> {
    const now = new Date().toISOString();
    const candidates = generateDomainCandidates(query.companyName).slice(0, MAX_CANDIDATES_TO_TRY);

    if (candidates.length === 0) {
      return { hasWebsite: false, checkedVia: this.name, checkedAt: now };
    }

    for (const candidate of candidates) {
      const result = await probeCandidate(candidate);
      if (result.ok) {
        return { hasWebsite: true, websiteUrl: result.finalUrl, checkedVia: this.name, checkedAt: now };
      }
    }

    logger.info("Nenhum domínio candidato resolveu a um site real", {
      checker: this.name,
      companyName: query.companyName,
      candidatesTried: candidates.length,
    });

    return { hasWebsite: false, checkedVia: this.name, checkedAt: now };
  }
}
