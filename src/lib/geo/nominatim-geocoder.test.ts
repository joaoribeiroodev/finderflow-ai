import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { geocodeAddress } from "./nominatim-geocoder";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("geocodeAddress", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retorna null sem bater na rede quando não há cidade nem UF", async () => {
    const result = await geocodeAddress({ street: "Rua das Flores" });
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("monta a query com rua/cidade/UF/Brasil e envia um User-Agent identificável", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ lat: "-12.9747", lon: "-38.4767" }]));

    const result = await geocodeAddress({
      street: "Rua das Flores, 100",
      city: "Salvador",
      state: "BA",
    });

    expect(result).toEqual({ latitude: -12.9747, longitude: -38.4767 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("nominatim.openstreetmap.org/search");
    expect(url).toContain("countrycodes=br");
    const queryParam = new URL(url).searchParams.get("q");
    expect(queryParam).toBe("Rua das Flores, 100, Salvador, BA, Brasil");
    expect((init.headers as Record<string, string>)["user-agent"]).toMatch(/FinderFlowAI/);
  });

  it("retorna null (sem lançar) quando o Nominatim não encontra nada", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const result = await geocodeAddress({ city: "Cidade Inexistente", state: "XX" });
    expect(result).toBeNull();
  });

  it("lança (não retorna null) em falha de rede/5xx, para o chamador tentar de novo depois", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 503));
    await expect(geocodeAddress({ city: "Salvador", state: "BA" })).rejects.toThrow();
  });

  it("serializa chamadas concorrentes respeitando ~1 req/s do Nominatim", async () => {
    fetchMock.mockImplementation(async () => jsonResponse([{ lat: "1", lon: "2" }]));

    const start = Date.now();
    await Promise.all([
      geocodeAddress({ city: "Salvador", state: "BA" }),
      geocodeAddress({ city: "Recife", state: "PE" }),
    ]);
    const elapsed = Date.now() - start;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(elapsed).toBeGreaterThanOrEqual(1_000);
  });
});
