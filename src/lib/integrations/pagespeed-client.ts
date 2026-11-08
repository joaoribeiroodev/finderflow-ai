import "server-only";

/**
 * Cliente para a Google PageSpeed Insights API v5 (gratuita, cota de 25k
 * requisições/dia por chave — ver docs/DECISIONS.md e
 * ETAPA-0-AUDITORIA.md seção 6). Separado em "chamada HTTP" (`fetchPageSpeedResult`)
 * e "extração dos sinais" (`extractWebsiteAuditSignals`, função pura) para
 * poder testar o parsing sem rede — mesmo princípio usado em
 * `digital-presence-score.ts`.
 */

const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const FETCH_TIMEOUT_MS = 25_000; // Vercel function padrão é 10-60s — margem de segurança.

export type PageSpeedStrategy = "mobile" | "desktop";

export class PageSpeedApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PageSpeedApiError";
  }
}

export interface WebsiteAuditIssue {
  id: string;
  title: string;
  description: string;
}

export interface WebsiteAuditSignals {
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  largestContentfulPaintMs: number | null;
  cumulativeLayoutShift: number | null;
  totalBlockingTimeMs: number | null;
  issues: WebsiteAuditIssue[];
}

/** Resultado bruto que nos interessa da resposta da PageSpeed API v5 (Lighthouse). */
export interface RawPageSpeedResult {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null } | undefined>;
    audits?: Record<
      string,
      { id?: string; title?: string; description?: string; score?: number | null; numericValue?: number } | undefined
    >;
  };
}

const ISSUE_AUDIT_IDS = [
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "total-blocking-time",
  "render-blocking-resources",
  "unused-javascript",
  "unminified-css",
  "unminified-javascript",
  "offscreen-images",
  "uses-responsive-images",
  "viewport",
  "image-alt",
  "color-contrast",
  "document-title",
  "meta-description",
  "tap-targets",
];

const MAX_ISSUES = 6;

function toScore100(score: number | null | undefined): number | null {
  if (score === null || score === undefined) return null;
  return Math.round(score * 100);
}

/**
 * Função pura: mesma entrada, mesma saída, sem I/O — extrai os 4 scores
 * (performance/acessibilidade/boas práticas/SEO), as 3 Core Web Vitals
 * (LCP/CLS/TBT) e até `MAX_ISSUES` problemas (audits com score baixo,
 * priorizando os de maior impacto) de um resultado já obtido da API.
 */
export function extractWebsiteAuditSignals(raw: RawPageSpeedResult): WebsiteAuditSignals {
  const categories = raw.lighthouseResult?.categories ?? {};
  const audits = raw.lighthouseResult?.audits ?? {};

  const lcpMs = audits["largest-contentful-paint"]?.numericValue;
  const cls = audits["cumulative-layout-shift"]?.numericValue;
  const tbtMs = audits["total-blocking-time"]?.numericValue;

  const issues: WebsiteAuditIssue[] = ISSUE_AUDIT_IDS.filter((auditId) => {
    const audit = audits[auditId];
    // Só entra como "problema" se a auditoria rodou (score não-nulo) e
    // encontrou algo a melhorar (score < 0.9 — convenção do próprio
    // Lighthouse para "não aprovado").
    return audit && typeof audit.score === "number" && audit.score < 0.9;
  })
    .slice(0, MAX_ISSUES)
    .map((auditId) => {
      const audit = audits[auditId]!;
      return {
        id: auditId,
        title: audit.title ?? auditId,
        description: audit.description ?? "",
      };
    });

  return {
    performanceScore: toScore100(categories.performance?.score),
    accessibilityScore: toScore100(categories.accessibility?.score),
    bestPracticesScore: toScore100(categories["best-practices"]?.score),
    seoScore: toScore100(categories.seo?.score),
    largestContentfulPaintMs: typeof lcpMs === "number" ? Math.round(lcpMs) : null,
    cumulativeLayoutShift: typeof cls === "number" ? cls : null,
    totalBlockingTimeMs: typeof tbtMs === "number" ? Math.round(tbtMs) : null,
    issues,
  };
}

/**
 * Chama a PageSpeed Insights API para a URL informada. Lança
 * `PageSpeedApiError` em qualquer falha (URL inválida, chave inválida,
 * cota excedida, timeout) — quem chamar decide como registrar (ver
 * `website-audit.service.ts`, que grava `status: 'failed'` em vez de
 * propagar a excepção para o usuário final).
 */
export async function fetchPageSpeedResult(
  url: string,
  apiKey: string,
  strategy: PageSpeedStrategy = "mobile",
): Promise<RawPageSpeedResult> {
  const params = new URLSearchParams({ url, key: apiKey, strategy });
  for (const category of ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"]) {
    params.append("category", category);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${PAGESPEED_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new PageSpeedApiError(
        `PageSpeed API retornou ${response.status}: ${body.slice(0, 300)}`,
        response.status,
      );
    }

    return (await response.json()) as RawPageSpeedResult;
  } catch (error) {
    if (error instanceof PageSpeedApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PageSpeedApiError("Tempo limite excedido ao consultar a PageSpeed API.");
    }
    throw new PageSpeedApiError((error as Error).message);
  } finally {
    clearTimeout(timeout);
  }
}
