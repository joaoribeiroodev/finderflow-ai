import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema, resetPasswordSchema } from "./auth";

describe("loginSchema", () => {
  it("aceita credenciais válidas", () => {
    const result = loginSchema.safeParse({
      email: "joao@example.com",
      password: "senha123",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    const result = loginSchema.safeParse({
      email: "não-é-email",
      password: "senha123",
    });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("rejeita quando as senhas não coincidem", () => {
    const result = registerSchema.safeParse({
      fullName: "João Pedro",
      email: "joao@example.com",
      password: "senha12345",
      confirmPassword: "outra-senha",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeTruthy();
    }
  });

  it("rejeita senha curta", () => {
    const result = registerSchema.safeParse({
      fullName: "João Pedro",
      email: "joao@example.com",
      password: "123",
      confirmPassword: "123",
    });
    expect(result.success).toBe(false);
  });

  it("aceita dados válidos", () => {
    const result = registerSchema.safeParse({
      fullName: "João Pedro",
      email: "joao@example.com",
      password: "senha12345",
      confirmPassword: "senha12345",
    });
    expect(result.success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("exige confirmação igual", () => {
    const result = resetPasswordSchema.safeParse({
      password: "novaSenha123",
      confirmPassword: "diferente",
    });
    expect(result.success).toBe(false);
  });
});
