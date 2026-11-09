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
    vi.useRealTimers();
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

  it("tenta 4 vezes com backoff em 429 e lança mensagem de limitação se persistir", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const result = provider.search({ query: "x", state: "BA" });
    const assertion = expect(result).rejects.toThrow(/limitando as requisições/);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("tenta 4 vezes com backoff em 5xx e lança mensagem de indisponibilidade se persistir", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const result = provider.search({ query: "x", state: "BA" });
    const assertion = expect(result).rejects.toThrow(/indisponível ou muito lento/);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("devolve resultado parcial quando uma página seguinte falha depois de já ter empresas", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [SAMPLE_COMPANY], cursor: "42" }))
      .mockResolvedValue(new Response(null, { status: 429 }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const result = provider.search({ query: "x", state: "BA" });
    await vi.runAllTimersAsync();
    const page = await result;

    expect(page.items).toHaveLength(1);
    expect(page.partial).toBe(true);
    expect(page.nextPageToken).toBeUndefined();
  });

  it("getByCnpj: consulta GET /<cnpj> (só dígitos) e mapeia o resultado", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SAMPLE_COMPANY));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const item = await provider.getByCnpj("11.222.333/0001-81");

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://minhareceita.example/11222333000181");
    expect(item).toMatchObject({ externalId: "11222333000181", name: "Empresa Teste" });
  });

  it("getByCnpj: devolve null em 404 (CNPJ não encontrado), sem lançar", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const item = await provider.getByCnpj("11222333000181");

    expect(item).toBeNull();
  });

  it("getByCnpj: tenta 4 vezes com backoff em 429 e lança mensagem de limitação se persistir", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const result = provider.getByCnpj("11222333000181");
    const assertion = expect(result).rejects.toThrow(/limitando as requisições/);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("segue o cursor devolvido, aguarda entre páginas e para quando não há mais páginas", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [SAMPLE_COMPANY], cursor: "42" }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));

    const provider = new MinhaReceitaProvider("https://minhareceita.example");
    const result = provider.search({ query: "x", state: "BA" });
    await vi.runAllTimersAsync();
    const page = await result;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("cursor=42");
    expect(page.items).toHaveLength(1);
  });
});
