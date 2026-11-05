import { describe, expect, it } from "vitest";

import { buildRow } from "./export.service";

const BASE_ROW = {
  display_data: {},
  attribution: {},
  external_id: null,
  company_id: null,
  fetched_at: "2026-11-05T12:00:00.000Z",
};

describe("buildRow", () => {
  it("mapeia os campos principais de display_data", () => {
    const row = buildRow({
      ...BASE_ROW,
      external_id: "11222333000181",
      display_data: {
        name: "Padaria Bela Vista",
        category: "Padaria",
        address: "Rua X, 1",
        phone: "7100000000",
        website: "https://padariabelavista.com.br",
      },
      attribution: { source: "Receita Federal", via: "Minha Receita" },
    });

    expect(row.nome).toBe("Padaria Bela Vista");
    expect(row.categoria).toBe("Padaria");
    expect(row.endereco).toBe("Rua X, 1");
    expect(row.telefone).toBe("7100000000");
    expect(row.site).toBe("https://padariabelavista.com.br");
    expect(row.cnpj).toBe("11222333000181");
    expect(row.fonte).toBe("Minha Receita");
  });

  it("monta o endereço a partir de município/UF quando não há endereço completo", () => {
    const row = buildRow({
      ...BASE_ROW,
      display_data: { name: "X", raw: { municipio: "SALVADOR", uf: "BA" } },
    });
    expect(row.endereco).toBe("SALVADOR - BA");
  });

  it("marca 'Não verificado' quando a presença digital nunca foi checada", () => {
    const row = buildRow({ ...BASE_ROW, display_data: { name: "X" } });
    expect(row.temSiteIdentificado).toBe("Não verificado");
  });

  it("marca 'Sim' quando a presença digital já confirmou site", () => {
    const row = buildRow({
      ...BASE_ROW,
      display_data: { name: "X", webPresence: { hasWebsite: true, websiteUrl: "https://x.com.br" } },
    });
    expect(row.temSiteIdentificado).toBe("Sim");
    expect(row.site).toBe("https://x.com.br");
  });

  it("marca 'Não identificado' quando a presença digital já checou e não achou site", () => {
    const row = buildRow({ ...BASE_ROW, display_data: { name: "X", webPresence: { hasWebsite: false } } });
    expect(row.temSiteIdentificado).toBe("Não identificado");
  });

  it("marca jaCadastrada como 'Sim' quando há company_id", () => {
    const row = buildRow({ ...BASE_ROW, company_id: "company-1", display_data: { name: "X" } });
    expect(row.jaCadastrada).toBe("Sim");
  });

  it("usa um nome de fallback quando display_data não tem nome", () => {
    const row = buildRow({ ...BASE_ROW, display_data: {} });
    expect(row.nome).toBe("(sem nome)");
  });
});
