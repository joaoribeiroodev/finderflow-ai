import { describe, expect, it } from "vitest";

import { generateDomainCandidates } from "./domain-candidates";

describe("generateDomainCandidates", () => {
  it("remove sufixo jurídico e gera variações com/sem www e hífen", () => {
    const candidates = generateDomainCandidates("Padaria Bela Vista Ltda");

    expect(candidates).toContain("https://www.padariabelavista.com.br");
    expect(candidates).toContain("https://padariabelavista.com.br");
    expect(candidates).toContain("https://www.padaria-bela-vista.com.br");
    expect(candidates.some((c) => c.includes("ltda"))).toBe(false);
  });

  it("remove acentos e pontuação", () => {
    const candidates = generateDomainCandidates("Confeitaria São José & Cia");
    expect(candidates.some((c) => c.includes("confeitariasaojose"))).toBe(true);
  });

  it("não gera candidatos para nomes vagos demais após limpeza", () => {
    expect(generateDomainCandidates("ME")).toHaveLength(0);
    expect(generateDomainCandidates("")).toHaveLength(0);
  });

  it("não repete candidatos duplicados", () => {
    const candidates = generateDomainCandidates("ABC");
    expect(candidates.length).toBe(new Set(candidates).size);
  });
});
