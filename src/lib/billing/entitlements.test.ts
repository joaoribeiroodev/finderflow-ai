import { describe, expect, it } from "vitest";

import { currentCalendarMonthBounds, planAiMonthlyLimit } from "./entitlements";

describe("planAiMonthlyLimit", () => {
  it("lê o limite do plano quando presente", () => {
    expect(planAiMonthlyLimit({ ai_monthly_requests: 500 })).toBe(500);
  });

  it("retorna null quando a chave está ausente", () => {
    expect(planAiMonthlyLimit({ copilot: true })).toBeNull();
  });

  it("retorna null para limits malformado (não é objeto)", () => {
    expect(planAiMonthlyLimit(null)).toBeNull();
    expect(planAiMonthlyLimit("texto" as never)).toBeNull();
    expect(planAiMonthlyLimit([1, 2, 3] as never)).toBeNull();
  });

  it("retorna null se o valor não é number", () => {
    expect(planAiMonthlyLimit({ ai_monthly_requests: "muitos" } as never)).toBeNull();
  });
});

describe("currentCalendarMonthBounds", () => {
  it("calcula início e fim do mês em UTC, alinhado a date_trunc('month', now()) do Postgres", () => {
    const { start, end } = currentCalendarMonthBounds(new Date("2026-11-15T10:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("lida com dezembro -> janeiro do ano seguinte", () => {
    const { start, end } = currentCalendarMonthBounds(new Date("2026-12-31T23:59:59Z"));
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
