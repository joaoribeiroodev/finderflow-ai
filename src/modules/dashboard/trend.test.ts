import { describe, expect, it } from "vitest";

import { aggregateByMonth, buildMonthBuckets } from "./trend";

describe("buildMonthBuckets", () => {
  it("gera N meses civis terminando no mês de referência", () => {
    const buckets = buildMonthBuckets(3, new Date("2026-11-15T12:00:00Z"));
    expect(buckets.map((b) => b.key)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(buckets.every((b) => b.value === 0)).toBe(true);
  });

  it("atravessa a virada de ano corretamente", () => {
    const buckets = buildMonthBuckets(3, new Date("2026-01-10T00:00:00Z"));
    expect(buckets.map((b) => b.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("aggregateByMonth", () => {
  const buckets = buildMonthBuckets(3, new Date("2026-11-15T00:00:00Z"));

  it("soma valores no bucket do mês correto", () => {
    const items = [
      { created_at: "2026-11-02T00:00:00Z", amount: 100 },
      { created_at: "2026-11-20T00:00:00Z", amount: 50 },
      { created_at: "2026-10-01T00:00:00Z", amount: 30 },
    ];
    const result = aggregateByMonth(items, (i) => i.created_at, (i) => i.amount, buckets);
    expect(result.find((b) => b.key === "2026-11")?.value).toBe(150);
    expect(result.find((b) => b.key === "2026-10")?.value).toBe(30);
    expect(result.find((b) => b.key === "2026-09")?.value).toBe(0);
  });

  it("ignora itens com data nula ou fora da janela", () => {
    const items = [
      { created_at: null, amount: 999 },
      { created_at: "2024-01-01T00:00:00Z", amount: 999 },
    ];
    const result = aggregateByMonth(items, (i) => i.created_at, (i) => i.amount, buckets);
    expect(result.reduce((s, b) => s + b.value, 0)).toBe(0);
  });

  it("conta ocorrências quando valueOf retorna 1 (ex.: contagem de leads)", () => {
    const items = [{ created_at: "2026-11-05T00:00:00Z" }, { created_at: "2026-11-06T00:00:00Z" }];
    const result = aggregateByMonth(items, (i) => i.created_at, () => 1, buckets);
    expect(result.find((b) => b.key === "2026-11")?.value).toBe(2);
  });
});
