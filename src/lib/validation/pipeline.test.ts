import { describe, expect, it } from "vitest";

import { stageCreateSchema, stageUpdateSchema } from "./pipeline";

describe("stageCreateSchema", () => {
  it("usa cor padrão quando ausente", () => {
    const result = stageCreateSchema.safeParse({ name: "Novo contato" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.color).toBe("#C68A3B");
  });

  it("rejeita cor fora do formato hex", () => {
    const result = stageCreateSchema.safeParse({ name: "Novo contato", color: "roxo" });
    expect(result.success).toBe(false);
  });

  it("normaliza resultType vazio ('') vindo do <select> para null", () => {
    const result = stageCreateSchema.safeParse({ name: "Em conversa", resultType: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.resultType).toBeNull();
  });

  it("aceita resultType won/lost", () => {
    const won = stageCreateSchema.safeParse({ name: "Ganho", resultType: "won" });
    expect(won.success).toBe(true);
    if (won.success) expect(won.data.resultType).toBe("won");
  });

  it("rejeita nome muito curto", () => {
    const result = stageCreateSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });
});

describe("stageUpdateSchema", () => {
  it("exige stageId válido", () => {
    const result = stageUpdateSchema.safeParse({ name: "Em conversa", stageId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});
