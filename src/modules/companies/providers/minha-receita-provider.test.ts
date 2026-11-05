import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BusinessSearchQueryTooBroadError } from "./business-data-provider";
import { MinhaReceitaProvider } from "./minha-receita-provider";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const SAMPLE_COMPANY = {
  cnpj: "11222333000181",
  razao_social: "EMPRESA TESTE LTDA",
  nome_fantasia: "Empresa Teste",
  cnae_fiscal: 5611201,
  cnae_fiscal_descricao: "Restaurantes e similares",
  descricao_tipo_de_logradouro: "RUA",
  logradouro: "DAS FLORES",
  numero: "100",
  bairro: "CENTRO",
  municipio: "SALVADOR",
  uf: "BA",
  cep: "40000000",
  ddd_telefone_1: "7100000000",
  email: null,
  descricao_situacao_cadastral: "ATIVA",
  qsa: [],
};

describe("MinhaReceitaProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lança BusinessSearchQueryTooBroadError sem CNAE, UF ou cursor", async () => {
    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    await expect(provider.search({ query: "empresas" })).rejects.toBeInstanceOf(
      BusinessSearchQueryTooBroadError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("busca por UF e mapeia o resultado com atribuição", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [SAMPLE_COMPANY] }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const page = await provider.search({ query: "empresas", state: "ba" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("uf=BA");

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      externalId: "11222333000181",
      provider: "minha_receita",
      name: "Empresa Teste",
      category: "Restaurantes e similares",
    });
    expect(page.items[0].attribution.via).toContain("Minha Receita");
    expect(page.nextPageToken).toBeUndefined();
  });

  it("envia um parâmetro cnae por código informado", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    await provider.search({ query: "x", cnaeCodes: ["5611201", "5611203"] });

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("cnae=5611201");
    expect(calledUrl).toContain("cnae=5611203");
  });

  it("filtra por cidade no lado do app quando o município não casa", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [SAMPLE_COMPANY, { ...SAMPLE_COMPANY, cnpj: "99", municipio: "FEIRA DE SANTANA" }] }),
    );

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const page = await provider.search({ query: "x", state: "BA", city: "salvador" });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].externalId).toBe("11222333000181");
  });

  it("indica quando o match foi por CNAE secundário, não o principal", async () => {
    const secondaryMatchCompany = {
      ...SAMPLE_COMPANY,
      cnae_fiscal: 5620101,
      cnae_fiscal_descricao: "Fornecimento de alimentos preparados preponderantemente para consumo domiciliar",
      cnaes_secundarios: [{ codigo: 5611201, descricao: "Restaurantes e similares" }],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [secondaryMatchCompany] }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const page = await provider.search({ query: "restaurantes", cnaeCodes: ["5611201"] });

    expect(page.items[0].category).toBe(
      "Restaurantes e similares (atividade secundária; principal: Fornecimento de alimentos preparados preponderantemente para consumo domiciliar)",
    );
  });

  it("mantém a descrição do CNAE principal quando ele mesmo casou com a busca", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [SAMPLE_COMPANY] }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const page = await provider.search({ query: "restaurantes", cnaeCodes: ["5611201"] });

    expect(page.items[0].category).toBe("Restaurantes e similares");
  });

  it("repete uma vez em 429 e lança erro claro se persistir", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    await expect(provider.search({ query: "x", state: "BA" })).rejects.toThrow(
      /Não foi possível buscar empresas/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("segue o cursor devolvido e para quando não há mais páginas", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [SAMPLE_COMPANY], cursor: "42" }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const page = await provider.search({ query: "x", state: "BA" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=42");
    expect(page.items).toHaveLength(1);
  });
});
