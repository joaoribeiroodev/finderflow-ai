import { describe, expect, it, vi } from "vitest";

import {
  BusinessSearchQueryTooBroadError,
  type BusinessDataProvider,
  type BusinessSearchPage,
  type BusinessSearchResultItem,
} from "./business-data-provider";
import {
  CachedBusinessDataProvider,
  structuredSearchKeyParts,
  type ProviderCacheEntry,
  type ProviderCacheStore,
} from "./cached-provider";

const HOUR = 60 * 60 * 1000;
const T0 = new Date("2026-11-09T12:00:00Z").getTime();

function item(id: string): BusinessSearchResultItem {
  return {
    externalId: id,
    provider: "fake",
    name: `Empresa ${id}`,
    displayData: {},
    attribution: {},
    fetchedAt: new Date(T0).toISOString(),
  };
}

/** Store em memória cujo relógio é o mesmo `now` injetado no provedor. */
class MemoryStore implements ProviderCacheStore {
  entries = new Map<string, ProviderCacheEntry>();
  constructor(private readonly now: () => number) {}
  async get(key: string) {
    return this.entries.get(key) ?? null;
  }
  async set(key: string, entry: { payload: unknown }) {
    this.entries.set(key, { payload: entry.payload, fetchedAt: new Date(this.now()).toISOString() });
  }
}

function setup(overrides: Partial<BusinessDataProvider> = {}) {
  let now = T0;
  const clock = () => now;
  const search = vi.fn(async (): Promise<BusinessSearchPage> => ({ items: [item("1")] }));
  const getByCnpj = vi.fn(async (): Promise<BusinessSearchResultItem | null> => item("11222333000181"));
  const inner: BusinessDataProvider = { name: "fake", search, getByCnpj, ...overrides };
  const store = new MemoryStore(clock);
  const provider = new CachedBusinessDataProvider(inner, store, {
    now: clock,
    searchKeyParts: structuredSearchKeyParts,
  });
  return {
    provider,
    store,
    search,
    getByCnpj,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("CachedBusinessDataProvider", () => {
  it("devolve do cache uma busca igual dentro do TTL, sem chamar o provedor de novo", async () => {
    const { provider, search } = setup();

    const first = await provider.search({ query: "restaurantes", state: "BA", cnaeCodes: ["5611201"] });
    const second = await provider.search({ query: "restaurante em salvador", state: "ba", cnaeCodes: ["5611201"] });

    expect(search).toHaveBeenCalledTimes(1);
    expect(first.cache).toBeUndefined();
    expect(second.cache?.state).toBe("fresh");
    expect(second.items).toHaveLength(1);
  });

  it("trata UF/CNAE diferentes como buscas diferentes", async () => {
    const { provider, search } = setup();

    await provider.search({ query: "x", state: "BA", cnaeCodes: ["5611201"] });
    await provider.search({ query: "x", state: "SP", cnaeCodes: ["5611201"] });
    await provider.search({ query: "x", state: "BA", cnaeCodes: ["5611203"] });

    expect(search).toHaveBeenCalledTimes(3);
  });

  it("consulta o provedor de novo depois que o TTL expira", async () => {
    const { provider, search, advance } = setup();

    await provider.search({ query: "x", state: "BA" });
    advance(25 * HOUR);
    const page = await provider.search({ query: "x", state: "BA" });

    expect(search).toHaveBeenCalledTimes(2);
    expect(page.cache).toBeUndefined();
  });

  it("devolve a última resposta conhecida (stale) quando o provedor falha após o TTL", async () => {
    const { provider, search, advance } = setup();

    await provider.search({ query: "x", state: "BA" });
    advance(25 * HOUR);
    search.mockRejectedValueOnce(new Error("429"));
    const page = await provider.search({ query: "x", state: "BA" });

    expect(page.cache?.state).toBe("stale");
    expect(page.cache?.fetchedAt).toBe(new Date(T0).toISOString());
    expect(page.items).toHaveLength(1);
  });

  it("propaga o erro quando o provedor falha e não há nada em cache", async () => {
    const { provider, search } = setup();
    search.mockRejectedValueOnce(new Error("fora do ar"));

    await expect(provider.search({ query: "x", state: "BA" })).rejects.toThrow("fora do ar");
  });

  it("não usa stale mais velho que o limite", async () => {
    const { provider, search, advance } = setup();

    await provider.search({ query: "x", state: "BA" });
    advance(31 * 24 * HOUR);
    search.mockRejectedValueOnce(new Error("fora do ar"));

    await expect(provider.search({ query: "x", state: "BA" })).rejects.toThrow("fora do ar");
  });

  it("nunca mascara erro de busca ampla demais com cache", async () => {
    const { provider, search } = setup();
    search.mockRejectedValueOnce(new BusinessSearchQueryTooBroadError());

    await expect(provider.search({ query: "x" })).rejects.toBeInstanceOf(BusinessSearchQueryTooBroadError);
  });

  it("não guarda página parcial", async () => {
    const { provider, search } = setup();
    search.mockResolvedValueOnce({ items: [item("1")], partial: true });

    await provider.search({ query: "x", state: "BA" });
    await provider.search({ query: "x", state: "BA" });

    expect(search).toHaveBeenCalledTimes(2);
  });

  it("continua funcionando se o cache estiver quebrado", async () => {
    const { provider, store, search } = setup();
    vi.spyOn(store, "get").mockRejectedValue(new Error("tabela ausente"));
    vi.spyOn(store, "set").mockRejectedValue(new Error("tabela ausente"));

    const page = await provider.search({ query: "x", state: "BA" });

    expect(page.items).toHaveLength(1);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("getByCnpj: usa o cache e ignora pontuação na chave", async () => {
    const { provider, getByCnpj } = setup();

    await provider.getByCnpj!("11.222.333/0001-81");
    const again = await provider.getByCnpj!("11222333000181");

    expect(getByCnpj).toHaveBeenCalledTimes(1);
    expect(again?.externalId).toBe("11222333000181");
  });

  it("getByCnpj: não guarda 'não encontrado' e cai no stale se o provedor falhar", async () => {
    const { provider, getByCnpj, advance } = setup();

    getByCnpj.mockResolvedValueOnce(null);
    expect(await provider.getByCnpj!("11222333000181")).toBeNull();
    await provider.getByCnpj!("11222333000181");
    expect(getByCnpj).toHaveBeenCalledTimes(2);

    advance(8 * 24 * HOUR);
    getByCnpj.mockRejectedValueOnce(new Error("429"));
    expect((await provider.getByCnpj!("11222333000181"))?.name).toBe("Empresa 11222333000181");
  });

  it("não expõe getByCnpj quando o provedor interno não tem", () => {
    const { provider } = setup({ getByCnpj: undefined });
    expect(provider.getByCnpj).toBeUndefined();
  });
});
