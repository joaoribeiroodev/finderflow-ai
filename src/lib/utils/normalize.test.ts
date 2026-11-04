import { describe, expect, it } from "vitest";

import {
  formatCnpj,
  isValidCnpj,
  normalizeCompanyName,
  normalizeDocument,
  normalizeDomain,
} from "./normalize";

describe("normalizeCompanyName", () => {
  it("remove acentos, pontuação e colapsa espaços", () => {
    expect(normalizeCompanyName("  Açaí & Cia.  Ltda.  ")).toBe("acai cia ltda");
  });

  it("é idempotente / consistente para comparação", () => {
    expect(normalizeCompanyName("Padaria São José")).toBe(normalizeCompanyName("padaria sao jose"));
  });
});

describe("normalizeDocument", () => {
  it("mantém apenas dígitos", () => {
    expect(normalizeDocument("12.345.678/0001-95")).toBe("12345678000195");
  });

  it("retorna null para vazio/nulo", () => {
    expect(normalizeDocument("")).toBeNull();
    expect(normalizeDocument(null)).toBeNull();
    expect(normalizeDocument(undefined)).toBeNull();
  });
});

describe("isValidCnpj", () => {
  it("aceita um CNPJ com dígitos verificadores válidos", () => {
    // CNPJ de exemplo comumente usado em documentação/testes (Banco do Brasil).
    expect(isValidCnpj("00.000.000/0001-91")).toBe(true);
  });

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    expect(isValidCnpj("11111111111111")).toBe(false);
  });

  it("rejeita CNPJ com dígito verificador incorreto", () => {
    expect(isValidCnpj("00.000.000/0001-00")).toBe(false);
  });

  it("rejeita tamanho inválido", () => {
    expect(isValidCnpj("123")).toBe(false);
  });
});

describe("normalizeDomain", () => {
  it("extrai o host sem www e sem protocolo", () => {
    expect(normalizeDomain("https://www.exemplo.com.br/pagina")).toBe("exemplo.com.br");
    expect(normalizeDomain("exemplo.com.br")).toBe("exemplo.com.br");
  });

  it("retorna null para entrada inválida ou vazia", () => {
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain("")).toBeNull();
  });
});

describe("formatCnpj", () => {
  it("formata 14 dígitos no padrão brasileiro", () => {
    expect(formatCnpj("00000000000191")).toBe("00.000.000/0001-91");
  });

  it("retorna o valor original se não tiver 14 dígitos", () => {
    expect(formatCnpj("123")).toBe("123");
  });
});
