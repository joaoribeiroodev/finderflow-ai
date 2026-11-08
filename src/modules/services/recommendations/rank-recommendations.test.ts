import { describe, expect, it } from "vitest";

import {
  rankRecommendations,
  summarizeByService,
  type ServiceRecommendationRow,
} from "./rank-recommendations";

function row(overrides: Partial<ServiceRecommendationRow> = {}): ServiceRecommendationRow {
  return {
    companyId: "company-1",
    companyName: "Empresa 1",
    analysisId: "analysis-1",
    companyScore: 50,
    analyzedAt: "2026-11-01T00:00:00Z",
    serviceId: "service-1",
    serviceName: "Gestão de redes sociais",
    reason: "Sem presença ativa nas redes.",
    priority: "medium",
    ...overrides,
  };
}

describe("rankRecommendations", () => {
  it("ordena prioridade alta antes de média e baixa", () => {
    const rows = [
      row({ companyId: "low", priority: "low" }),
      row({ companyId: "high", priority: "high" }),
      row({ companyId: "medium", priority: "medium" }),
    ];

    const ranked = rankRecommendations(rows);

    expect(ranked.map((r) => r.companyId)).toEqual(["high", "medium", "low"]);
  });

  it("dentro da mesma prioridade, ordena por company_score decrescente", () => {
    const rows = [
      row({ companyId: "a", priority: "high", companyScore: 40 }),
      row({ companyId: "b", priority: "high", companyScore: 90 }),
      row({ companyId: "c", priority: "high", companyScore: 60 }),
    ];

    const ranked = rankRecommendations(rows);

    expect(ranked.map((r) => r.companyId)).toEqual(["b", "c", "a"]);
  });

  it("trata company_score nulo como 0, sem quebrar a ordenação", () => {
    const rows = [
      row({ companyId: "null-score", priority: "high", companyScore: null }),
      row({ companyId: "has-score", priority: "high", companyScore: 10 }),
    ];

    const ranked = rankRecommendations(rows);

    expect(ranked.map((r) => r.companyId)).toEqual(["has-score", "null-score"]);
  });

  it("não modifica o array original (função pura)", () => {
    const rows = [row({ companyId: "a", priority: "low" }), row({ companyId: "b", priority: "high" })];
    const original = [...rows];

    rankRecommendations(rows);

    expect(rows).toEqual(original);
  });
});

describe("summarizeByService", () => {
  it("agrupa por serviço e conta prioridades altas", () => {
    const rows = [
      row({ serviceId: "svc-1", serviceName: "SEO", priority: "high" }),
      row({ serviceId: "svc-1", serviceName: "SEO", priority: "medium" }),
      row({ serviceId: "svc-2", serviceName: "Tráfego pago", priority: "high" }),
    ];

    const summary = summarizeByService(rows);

    expect(summary).toEqual([
      { serviceId: "svc-1", serviceName: "SEO", count: 2, highPriorityCount: 1 },
      { serviceId: "svc-2", serviceName: "Tráfego pago", count: 1, highPriorityCount: 1 },
    ]);
  });

  it("agrupa oportunidades sem service_id pelo nome do serviço", () => {
    const rows = [
      row({ serviceId: null, serviceName: "Consultoria genérica", priority: "low" }),
      row({ serviceId: null, serviceName: "Consultoria genérica", priority: "low" }),
    ];

    const summary = summarizeByService(rows);

    expect(summary).toEqual([
      { serviceId: null, serviceName: "Consultoria genérica", count: 2, highPriorityCount: 0 },
    ]);
  });

  it("ordena por contagem decrescente", () => {
    const rows = [
      row({ serviceId: "rare", serviceName: "Raro" }),
      row({ serviceId: "common", serviceName: "Comum" }),
      row({ serviceId: "common", serviceName: "Comum" }),
    ];

    const summary = summarizeByService(rows);

    expect(summary.map((s) => s.serviceId)).toEqual(["common", "rare"]);
  });
});
