import { describe, expect, it } from "vitest";

import { extractWebsiteAuditSignals, type RawPageSpeedResult } from "./pagespeed-client";

function buildRaw(overrides: Partial<RawPageSpeedResult["lighthouseResult"]> = {}): RawPageSpeedResult {
  return {
    lighthouseResult: {
      categories: {
        performance: { score: 0.93 },
        accessibility: { score: 0.81 },
        "best-practices": { score: 1 },
        seo: { score: 0.75 },
      },
      audits: {
        "largest-contentful-paint": { numericValue: 2400, score: 0.8 },
        "cumulative-layout-shift": { numericValue: 0.05, score: 0.95 },
        "total-blocking-time": { numericValue: 120, score: 0.9 },
        viewport: { score: 1, title: "Viewport configurado" },
        "image-alt": {
          score: 0.4,
          title: "Imagens sem texto alternativo",
          description: "Algumas imagens não têm atributo alt.",
        },
        "color-contrast": { score: 0.5, title: "Contraste de cores insuficiente" },
      },
      ...overrides,
    },
  };
}

describe("extractWebsiteAuditSignals", () => {
  it("converte scores de 0-1 (Lighthouse) para 0-100", () => {
    const signals = extractWebsiteAuditSignals(buildRaw());
    expect(signals.performanceScore).toBe(93);
    expect(signals.accessibilityScore).toBe(81);
    expect(signals.bestPracticesScore).toBe(100);
    expect(signals.seoScore).toBe(75);
  });

  it("extrai as 3 Core Web Vitals (LCP em ms, CLS, TBT em ms)", () => {
    const signals = extractWebsiteAuditSignals(buildRaw());
    expect(signals.largestContentfulPaintMs).toBe(2400);
    expect(signals.cumulativeLayoutShift).toBe(0.05);
    expect(signals.totalBlockingTimeMs).toBe(120);
  });

  it("só lista como problema auditorias com score < 0.9 (convenção do Lighthouse)", () => {
    const signals = extractWebsiteAuditSignals(buildRaw());
    const ids = signals.issues.map((i) => i.id);
    expect(ids).toContain("image-alt");
    expect(ids).toContain("color-contrast");
    expect(ids).not.toContain("viewport"); // score 1 — aprovado, não é problema
  });

  it("retorna score null quando a categoria não veio na resposta (nunca inventa um número)", () => {
    const signals = extractWebsiteAuditSignals({ lighthouseResult: { categories: {}, audits: {} } });
    expect(signals.performanceScore).toBeNull();
    expect(signals.accessibilityScore).toBeNull();
    expect(signals.largestContentfulPaintMs).toBeNull();
    expect(signals.issues).toEqual([]);
  });

  it("lida com resposta totalmente vazia sem lançar", () => {
    expect(() => extractWebsiteAuditSignals({})).not.toThrow();
  });
});
