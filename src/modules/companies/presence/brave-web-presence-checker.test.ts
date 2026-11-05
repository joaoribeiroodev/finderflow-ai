import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BraveWebPresenceChecker } from "./brave-web-presence-checker";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("BraveWebPresenceChecker", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia o token de autenticação e a query certa", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ web: { results: [] } }));

    const checker = new BraveWebPresenceChecker("test-key");
    await checker.check({ companyName: "Padaria Bom Pao", city: "Salvador", state: "BA" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("q=Padaria+Bom+Pao+Salvador+BA");
    expect((init?.headers as Record<string, string>)["x-subscription-token"]).toBe("test-key");
  });

  it("devolve hasWebsite=false quando não há resultados", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ web: { results: [] } }));

    const checker = new BraveWebPresenceChecker("test-key");
    const result = await checker.check({ companyName: "Padaria Bom Pao" });

    expect(result.hasWebsite).toBe(false);
    expect(result.websiteUrl).toBeUndefined();
  });

  it("devolve hasWebsite=false quando só há resultados de redes sociais/diretórios", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        web: {
          results: [
            { title: "Padaria Bom Pão", url: "https://www.instagram.com/padariabompao", description: "" },
            { title: "Padaria Bom Pão - CNPJ", url: "https://cnpj.biz/123", description: "" },
          ],
        },
      }),
    );

    const checker = new BraveWebPresenceChecker("test-key");
    const result = await checker.check({ companyName: "Padaria Bom Pao" });

    expect(result.hasWebsite).toBe(false);
  });

  it("devolve hasWebsite=true para um domínio próprio com nome parecido", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        web: {
          results: [
            { title: "Instagram", url: "https://www.instagram.com/padariabompao", description: "" },
            {
              title: "Padaria Bom Pão - o melhor pão da cidade",
              url: "https://www.padariabompao.com.br",
              description: "",
            },
          ],
        },
      }),
    );

    const checker = new BraveWebPresenceChecker("test-key");
    const result = await checker.check({ companyName: "Padaria Bom Pao" });

    expect(result.hasWebsite).toBe(true);
    expect(result.websiteUrl).toBe("https://www.padariabompao.com.br");
  });

  it("não confunde um domínio de nome totalmente diferente com o site da empresa", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        web: {
          results: [{ title: "Notícias da cidade", url: "https://www.jornaldacidade.com.br", description: "" }],
        },
      }),
    );

    const checker = new BraveWebPresenceChecker("test-key");
    const result = await checker.check({ companyName: "Padaria Bom Pao" });

    expect(result.hasWebsite).toBe(false);
  });

  it("lança erro claro quando a API responde com erro", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    const checker = new BraveWebPresenceChecker("test-key");
    await expect(checker.check({ companyName: "x" })).rejects.toThrow(/Não foi possível verificar/);
  });
});
