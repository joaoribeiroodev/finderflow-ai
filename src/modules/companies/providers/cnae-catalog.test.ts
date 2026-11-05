import { describe, expect, it } from "vitest";

import { CNAE_CATALOG, getCatalogEntryByKey, matchCatalogByKeyword } from "./cnae-catalog";

describe("cnae-catalog", () => {
  it("casa por palavra-chave simples", () => {
    const match = matchCatalogByKeyword("procuro restaurantes em Salvador");
    expect(match?.key).toBe("restaurantes");
  });

  it("ignora acentos e caixa ao casar", () => {
    const match = matchCatalogByKeyword("CLÍNICAS ODONTOLÓGICAS");
    expect(match?.key).toBe("clinicas_odontologicas");
  });

  it("devolve null quando nada casa", () => {
    expect(matchCatalogByKeyword("alguma coisa bem genérica e sem relação")).toBeNull();
  });

  it("devolve null para texto vazio", () => {
    expect(matchCatalogByKeyword("   ")).toBeNull();
  });

  it("getCatalogEntryByKey encontra entradas existentes e nega as inexistentes", () => {
    expect(getCatalogEntryByKey("academias")?.cnaeCodes).toEqual(["9313100"]);
    expect(getCatalogEntryByKey("chave-que-nao-existe")).toBeNull();
  });

  it("toda entrada tem ao menos um código de CNAE e uma palavra-chave", () => {
    for (const entry of CNAE_CATALOG) {
      expect(entry.cnaeCodes.length).toBeGreaterThan(0);
      expect(entry.keywords.length).toBeGreaterThan(0);
      for (const code of entry.cnaeCodes) {
        expect(code).toMatch(/^\d{7}$/);
      }
    }
  });

  it("não há chaves duplicadas no catálogo", () => {
    const keys = CNAE_CATALOG.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
