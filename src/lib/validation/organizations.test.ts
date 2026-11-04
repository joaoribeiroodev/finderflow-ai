import { describe, expect, it } from "vitest";

import { createOrganizationSchema, slugify } from "./organizations";

describe("slugify", () => {
  it("remove acentos e espaços", () => {
    expect(slugify("Agência João & Cia")).toBe("agencia-joao-cia");
  });

  it("colapsa hífens repetidos", () => {
    expect(slugify("  Minha   Organização  ")).toBe("minha-organizacao");
  });
});

describe("createOrganizationSchema", () => {
  it("rejeita slug com caracteres inválidos", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Minha Agência",
      slug: "Minha Agência!",
    });
    expect(result.success).toBe(false);
  });

  it("aceita nome e slug válidos", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Minha Agência",
      slug: "minha-agencia",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita slug muito curto", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Ok",
      slug: "ab",
    });
    expect(result.success).toBe(false);
  });
});
