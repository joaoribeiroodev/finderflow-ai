import { describe, expect, it } from "vitest";

import { billingProfileSchema, isValidCnpj, isValidCpf, isValidCpfOrCnpj } from "./document";

describe("isValidCpf", () => {
  it("aceita um CPF válido conhecido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejeita um CPF com dígito verificador errado", () => {
    expect(isValidCpf("52998224700")).toBe(false);
  });

  it("rejeita sequências triviais mesmo com 11 dígitos", () => {
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("00000000000")).toBe(false);
  });

  it("rejeita tamanho diferente de 11 dígitos", () => {
    expect(isValidCpf("123")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("aceita um CNPJ válido conhecido", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("rejeita um CNPJ com dígito verificador errado", () => {
    expect(isValidCnpj("11222333000180")).toBe(false);
  });

  it("rejeita sequência trivial", () => {
    expect(isValidCnpj("11111111111111")).toBe(false);
  });
});

describe("isValidCpfOrCnpj", () => {
  it("roteia por tamanho de dígitos", () => {
    expect(isValidCpfOrCnpj("529.982.247-25")).toBe(true);
    expect(isValidCpfOrCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita tamanho que não é nem CPF nem CNPJ", () => {
    expect(isValidCpfOrCnpj("123456")).toBe(false);
  });
});

describe("billingProfileSchema", () => {
  it("aceita um perfil de faturamento válido e normaliza o documento para dígitos", () => {
    const result = billingProfileSchema.safeParse({
      billingName: "Empresa Exemplo LTDA",
      billingDocument: "11.222.333/0001-81",
      billingEmail: "financeiro@exemplo.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.billingDocument).toBe("11222333000181");
    }
  });

  it("rejeita e-mail inválido", () => {
    const result = billingProfileSchema.safeParse({
      billingName: "Empresa Exemplo LTDA",
      billingDocument: "11222333000181",
      billingEmail: "não-é-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita CPF/CNPJ inválido", () => {
    const result = billingProfileSchema.safeParse({
      billingName: "Empresa Exemplo LTDA",
      billingDocument: "123",
      billingEmail: "financeiro@exemplo.com",
    });
    expect(result.success).toBe(false);
  });
});
