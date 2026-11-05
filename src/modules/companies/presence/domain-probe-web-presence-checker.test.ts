import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DomainProbeWebPresenceChecker } from "./domain-probe-web-presence-checker";

function htmlResponse(body: string, status = 200, finalUrl?: string): Response {
  const response = new Response(body, { status, headers: { "content-type": "text/html" } });
  if (finalUrl) Object.defineProperty(response, "url", { value: finalUrl });
  return response;
}

const REAL_LOOKING_HTML = `<!doctype html><html><head><title>Padaria Bela Vista</title></head><body>${"x".repeat(
  300,
)}</body></html>`;

describe("DomainProbeWebPresenceChecker", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devolve hasWebsite=true no primeiro candidato que resolve a um site real", async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse(REAL_LOOKING_HTML, 200, "https://www.padariabelavista.com.br/"));

    const checker = new DomainProbeWebPresenceChecker();
    const result = await checker.check({ companyName: "Padaria Bela Vista Ltda" });

    expect(result.hasWebsite).toBe(true);
    expect(result.websiteUrl).toBe("https://www.padariabelavista.com.br/");
    expect(result.checkedVia).toBe("domain_probe");
  });

  it("tenta o próximo candidato quando um responde com erro", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(htmlResponse(REAL_LOOKING_HTML, 200, "https://padariabelavista.com.br/"));

    const checker = new DomainProbeWebPresenceChecker();
    const result = await checker.check({ companyName: "Padaria Bela Vista Ltda" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.hasWebsite).toBe(true);
  });

  it("trata página de domínio estacionado/à venda como site inexistente", async () => {
    const parkedHtml = `<html><body>This domain is for sale. ${"x".repeat(300)}</body></html>`;
    fetchMock.mockResolvedValue(htmlResponse(parkedHtml, 200));

    const checker = new DomainProbeWebPresenceChecker();
    const result = await checker.check({ companyName: "Padaria Bela Vista Ltda" });

    expect(result.hasWebsite).toBe(false);
  });

  it("trata corpo HTML muito curto como provavelmente não um site real", async () => {
    fetchMock.mockResolvedValue(htmlResponse("<html></html>", 200));

    const checker = new DomainProbeWebPresenceChecker();
    const result = await checker.check({ companyName: "Padaria Bela Vista Ltda" });

    expect(result.hasWebsite).toBe(false);
  });

  it("devolve hasWebsite=false sem tentar nenhum fetch quando o nome não gera candidatos", async () => {
    const checker = new DomainProbeWebPresenceChecker();
    const result = await checker.check({ companyName: "ME" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.hasWebsite).toBe(false);
  });

  it("devolve hasWebsite=false quando todos os candidatos falham (timeout/erro de rede)", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));

    const checker = new DomainProbeWebPresenceChecker();
    const result = await checker.check({ companyName: "Padaria Bela Vista Ltda" });

    expect(result.hasWebsite).toBe(false);
  });
});
