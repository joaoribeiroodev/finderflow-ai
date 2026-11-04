import { describe, expect, it } from "vitest";

import { buildConversionBreakdown, resolveReportPeriod } from "./reports.service";

describe("buildConversionBreakdown", () => {
  it("calcula a taxa de conversão por grupo", () => {
    const result = buildConversionBreakdown([
      { key: "a", label: "Segmento A", status: "won" },
      { key: "a", label: "Segmento A", status: "won" },
      { key: "a", label: "Segmento A", status: "lost" },
      { key: "b", label: "Segmento B", status: "lost" },
    ]);

    const a = result.find((r) => r.key === "a");
    const b = result.find((r) => r.key === "b");

    expect(a).toMatchObject({ won: 2, lost: 1 });
    expect(a!.conversionRate).toBeCloseTo(2 / 3);
    expect(b).toMatchObject({ won: 0, lost: 1, conversionRate: 0 });
  });

  it("retorna conversionRate null quando não há entradas", () => {
    expect(buildConversionBreakdown([])).toEqual([]);
  });

  it("ordena do grupo com mais negociações para o com menos", () => {
    const result = buildConversionBreakdown([
      { key: "small", label: "Pequeno", status: "won" },
      { key: "big", label: "Grande", status: "won" },
      { key: "big", label: "Grande", status: "lost" },
      { key: "big", label: "Grande", status: "won" },
    ]);
    expect(result[0].key).toBe("big");
  });
});

describe("resolveReportPeriod", () => {
  it("usa o mês civil atual como padrão quando from/to não são informados", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const period = resolveReportPeriod(undefined, undefined, now);
    expect(period.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(period.end).toBe(now);
  });

  it("respeita from/to explícitos", () => {
    const period = resolveReportPeriod("2026-01-01", "2026-01-31");
    expect(period.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-01-31T23:59:59.999Z");
  });
});
