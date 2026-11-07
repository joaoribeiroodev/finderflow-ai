import { describe, expect, it } from "vitest";

import { computeBackoffSeconds, shouldDeadLetter } from "./retry-policy";

describe("computeBackoffSeconds", () => {
  it("cresce exponencialmente com o número de tentativas", () => {
    const a1 = computeBackoffSeconds(1);
    const a2 = computeBackoffSeconds(2);
    const a3 = computeBackoffSeconds(3);
    // jitter é até 20% — a faixa mínima de cada tentativa (sem jitter)
    // ainda deve ser estritamente maior que o máximo da anterior com jitter.
    expect(a1).toBeGreaterThanOrEqual(2);
    expect(a2).toBeGreaterThanOrEqual(4);
    expect(a3).toBeGreaterThanOrEqual(8);
  });

  it("nunca excede o teto de 1h mesmo com jitter", () => {
    const value = computeBackoffSeconds(20); // 2^20 >> 3600
    expect(value).toBeLessThanOrEqual(3600 * 1.2 + 1);
  });

  it("nunca retorna um valor negativo ou zero", () => {
    expect(computeBackoffSeconds(0)).toBeGreaterThan(0);
  });
});

describe("shouldDeadLetter", () => {
  it("é falso enquanto não atingiu o máximo de tentativas", () => {
    expect(shouldDeadLetter(1, 5)).toBe(false);
    expect(shouldDeadLetter(4, 5)).toBe(false);
  });

  it("é verdadeiro ao atingir ou exceder o máximo de tentativas", () => {
    expect(shouldDeadLetter(5, 5)).toBe(true);
    expect(shouldDeadLetter(6, 5)).toBe(true);
  });
});
