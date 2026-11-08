import { describe, expect, it } from "vitest";

import {
  buildConversionBreakdown,
  computeCadenceOutcomes,
  computeCampaignPerformance,
  resolveReportPeriod,
} from "./reports.service";

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

describe("computeCampaignPerformance", () => {
  it("calcula a taxa de resposta como respondido / (contatado + respondido)", () => {
    const result = computeCampaignPerformance([
      { status: "selected" },
      { status: "excluded" },
      { status: "contacted" },
      { status: "contacted" },
      { status: "responded" },
    ]);
    expect(result).toMatchObject({
      totalCompanies: 5,
      contactedCount: 2,
      respondedCount: 1,
      excludedCount: 1,
    });
    expect(result.responseRate).toBeCloseTo(1 / 3);
  });

  it("retorna responseRate null quando nenhuma empresa foi contatada ou respondeu ainda", () => {
    const result = computeCampaignPerformance([{ status: "selected" }, { status: "excluded" }]);
    expect(result.responseRate).toBeNull();
  });

  it("retorna tudo zerado para uma lista vazia", () => {
    const result = computeCampaignPerformance([]);
    expect(result).toEqual({
      totalCompanies: 0,
      contactedCount: 0,
      respondedCount: 0,
      excludedCount: 0,
      responseRate: null,
    });
  });
});

describe("computeCadenceOutcomes", () => {
  it("conta inscrições por status e agrupa motivos de parada", () => {
    const result = computeCadenceOutcomes(
      [
        { status: "active", stopped_reason: null },
        { status: "paused", stopped_reason: null },
        { status: "stopped", stopped_reason: "responded" },
        { status: "stopped", stopped_reason: "responded" },
        { status: "stopped", stopped_reason: "lead_won" },
        { status: "completed", stopped_reason: null },
      ],
      [{ status: "sent" }, { status: "sent" }, { status: "failed" }, { status: "skipped" }],
    );

    expect(result.enrollmentsStarted).toBe(6);
    expect(result.activeCount).toBe(1);
    expect(result.pausedCount).toBe(1);
    expect(result.stoppedCount).toBe(3);
    expect(result.completedCount).toBe(1);
    expect(result.stoppedReasons).toEqual([
      { reason: "responded", count: 2 },
      { reason: "lead_won", count: 1 },
    ]);
    expect(result.stepSends).toEqual([
      { status: "sent", count: 2 },
      { status: "failed", count: 1 },
      { status: "skipped", count: 1 },
    ]);
  });

  it("usa 'Sem motivo registrado' quando uma inscrição parada não tem stopped_reason", () => {
    const result = computeCadenceOutcomes([{ status: "stopped", stopped_reason: null }], []);
    expect(result.stoppedReasons).toEqual([{ reason: "Sem motivo registrado", count: 1 }]);
  });

  it("retorna tudo zerado para listas vazias", () => {
    const result = computeCadenceOutcomes([], []);
    expect(result.enrollmentsStarted).toBe(0);
    expect(result.stoppedReasons).toEqual([]);
    expect(result.stepSends).toEqual([
      { status: "sent", count: 0 },
      { status: "failed", count: 0 },
      { status: "skipped", count: 0 },
    ]);
  });
});
