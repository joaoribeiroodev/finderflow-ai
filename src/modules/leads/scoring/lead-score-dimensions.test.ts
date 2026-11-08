import { describe, expect, it } from "vitest";

import { LEAD_SCORE_CRITERIA, type LeadScoreResult } from "@/lib/ai/schemas";

import { computeLeadScoreDimensions, LEAD_SCORE_DIMENSIONS } from "./lead-score-dimensions";

function breakdownWith(scores: Partial<Record<string, number>>): LeadScoreResult["score_breakdown"] {
  return LEAD_SCORE_CRITERIA.map((criterion) => ({
    criterion: criterion.key,
    score: scores[criterion.key] ?? 0,
    rationale: "teste",
  }));
}

describe("LEAD_SCORE_DIMENSIONS", () => {
  it("cobre todos os 6 critérios existentes, cada um em exatamente uma dimensão", () => {
    const allCriteriaInDimensions = Object.values(LEAD_SCORE_DIMENSIONS).flatMap((d) => d.criteria);
    const allCriteriaKeys = LEAD_SCORE_CRITERIA.map((c) => c.key);

    expect(allCriteriaInDimensions.sort()).toEqual(allCriteriaKeys.sort());
    expect(new Set(allCriteriaInDimensions).size).toBe(allCriteriaInDimensions.length);
  });
});

describe("computeLeadScoreDimensions", () => {
  it("retorna 100 em todas as dimensões quando todos os critérios são 100", () => {
    const breakdown = breakdownWith({
      service_fit: 100,
      observable_need: 100,
      icp_fit: 100,
      data_quality: 100,
      contact_ease: 100,
      interest_signals: 100,
    });
    expect(computeLeadScoreDimensions(breakdown)).toEqual({
      potentialScore: 100,
      fitScore: 100,
      priorityScore: 100,
    });
  });

  it("retorna 0 em todas as dimensões quando todos os critérios são 0", () => {
    expect(computeLeadScoreDimensions(breakdownWith({}))).toEqual({
      potentialScore: 0,
      fitScore: 0,
      priorityScore: 0,
    });
  });

  it("faz a média ponderada correta dentro de uma dimensão com pesos diferentes", () => {
    // service_fit (peso 25) e observable_need (peso 25) têm o mesmo peso dentro de "potencial",
    // então a média simples dos dois é o esperado.
    const breakdown = breakdownWith({ service_fit: 80, observable_need: 40 });
    expect(computeLeadScoreDimensions(breakdown).potentialScore).toBe(60);
  });

  it("calcula as 3 dimensões de forma independente", () => {
    const breakdown = breakdownWith({
      service_fit: 90,
      observable_need: 70,
      icp_fit: 50,
      data_quality: 50,
      contact_ease: 20,
      interest_signals: 40,
    });
    const dims = computeLeadScoreDimensions(breakdown);
    expect(dims.potentialScore).toBe(80); // média de 90 e 70
    expect(dims.fitScore).toBe(50); // média de 50 e 50
    expect(dims.priorityScore).toBe(30); // média de 20 e 40
  });

  it("ignora critérios desconhecidos sem quebrar o cálculo", () => {
    const breakdown = [
      ...breakdownWith({ service_fit: 100, observable_need: 100, icp_fit: 100, data_quality: 100 }),
      { criterion: "um_criterio_que_nao_existe_mais", score: 999, rationale: "lixo" },
    ] as LeadScoreResult["score_breakdown"];
    const dims = computeLeadScoreDimensions(breakdown);
    expect(dims.potentialScore).toBe(100);
    expect(dims.fitScore).toBe(100);
  });
});
