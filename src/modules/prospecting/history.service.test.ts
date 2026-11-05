import { describe, expect, it } from "vitest";

import { mapResultRowToView } from "./history.service";

describe("mapResultRowToView", () => {
  it("mapeia os campos básicos e marca como não convertida quando company_id é nulo", () => {
    const view = mapResultRowToView({
      id: "r1",
      company_id: null,
      display_data: { name: "Padaria Bela Vista", category: "Padaria", address: "Rua X, 1", phone: "7100000000" },
      attribution: { source: "Receita Federal", via: "Minha Receita" },
    });

    expect(view).toMatchObject({
      searchResultId: "r1",
      name: "Padaria Bela Vista",
      category: "Padaria",
      address: "Rua X, 1",
      phone: "7100000000",
      alreadyConverted: false,
      attributionLabel: "Dados: Receita Federal (via Minha Receita)",
    });
    expect(view.cachedWebPresence).toBeUndefined();
  });

  it("marca como já convertida quando company_id está presente", () => {
    const view = mapResultRowToView({
      id: "r2",
      company_id: "company-123",
      display_data: { name: "X" },
      attribution: {},
    });

    expect(view.alreadyConverted).toBe(true);
  });

  it("usa um nome de fallback quando display_data não tem nome", () => {
    const view = mapResultRowToView({ id: "r3", company_id: null, display_data: {}, attribution: {} });
    expect(view.name).toBe("(sem nome)");
  });

  it("extrai a presença digital já verificada e salva em display_data.webPresence", () => {
    const view = mapResultRowToView({
      id: "r4",
      company_id: null,
      display_data: { name: "X", webPresence: { hasWebsite: true, websiteUrl: "https://x.com.br" } },
      attribution: {},
    });

    expect(view.cachedWebPresence).toEqual({ hasWebsite: true, websiteUrl: "https://x.com.br" });
  });

  it("extrai hasWebsite=false sem websiteUrl quando não há site identificado", () => {
    const view = mapResultRowToView({
      id: "r5",
      company_id: null,
      display_data: { name: "X", webPresence: { hasWebsite: false } },
      attribution: {},
    });

    expect(view.cachedWebPresence).toEqual({ hasWebsite: false, websiteUrl: undefined });
  });

  it("ignora um webPresence salvo em formato inesperado (sem quebrar)", () => {
    const view = mapResultRowToView({
      id: "r6",
      company_id: null,
      display_data: { name: "X", webPresence: "formato-antigo-invalido" },
      attribution: {},
    });

    expect(view.cachedWebPresence).toBeUndefined();
  });
});
