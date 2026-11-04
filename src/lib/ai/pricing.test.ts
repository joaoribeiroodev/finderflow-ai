import { describe, expect, it } from "vitest";

import { estimateCostUsd } from "./pricing";

describe("estimateCostUsd", () => {
  it("calcula o custo para um modelo conhecido", () => {
    // gpt-4.1-mini: input 0.4/1M, output 1.6/1M
    const cost = estimateCostUsd("gpt-4.1-mini", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.4 + 1.6, 6);
  });

  it("retorna 0 quando não há tokens", () => {
    expect(estimateCostUsd("gpt-4.1-mini", 0, 0)).toBe(0);
  });

  it("usa o preço de fallback para um modelo desconhecido, em vez de lançar erro", () => {
    const cost = estimateCostUsd("modelo-futuro-desconhecido", 1_000_000, 1_000_000);
    expect(cost).toBeGreaterThan(0);
  });

  it("escala linearmente com o número de tokens", () => {
    const costHalf = estimateCostUsd("gpt-4.1-mini", 500_000, 0);
    const costFull = estimateCostUsd("gpt-4.1-mini", 1_000_000, 0);
    expect(costFull).toBeCloseTo(costHalf * 2, 6);
  });
});
