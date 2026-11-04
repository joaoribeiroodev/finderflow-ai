import { describe, expect, it } from "vitest";

import { interactionCreateSchema } from "./interactions";
import { taskCreateSchema, taskStatusUpdateSchema } from "./tasks";

describe("interactionCreateSchema", () => {
  it("aceita um registro mínimo válido", () => {
    const result = interactionCreateSchema.safeParse({
      leadId: "11111111-1111-4111-8111-111111111111",
      type: "call",
      contentSummary: "Liguei e combinamos reunião na próxima semana.",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita tipo fora do enum", () => {
    const result = interactionCreateSchema.safeParse({
      leadId: "11111111-1111-4111-8111-111111111111",
      type: "carta",
      contentSummary: "x".repeat(10),
    });
    expect(result.success).toBe(false);
  });

  it("aceita occurredAt ausente (null) do FormData — campo não renderizado no form", () => {
    const result = interactionCreateSchema.safeParse({
      leadId: "11111111-1111-4111-8111-111111111111",
      type: "note",
      contentSummary: "Anotação de teste.",
      occurredAt: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.occurredAt).toBeUndefined();
  });

  it("rejeita resumo vazio", () => {
    const result = interactionCreateSchema.safeParse({
      leadId: "11111111-1111-4111-8111-111111111111",
      type: "note",
      contentSummary: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("taskCreateSchema / taskStatusUpdateSchema", () => {
  it("aceita tarefa sem descrição/data", () => {
    const result = taskCreateSchema.safeParse({
      leadId: "11111111-1111-4111-8111-111111111111",
      title: "Enviar proposta",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita status fora do enum", () => {
    const result = taskStatusUpdateSchema.safeParse({
      taskId: "11111111-1111-4111-8111-111111111111",
      status: "done",
    });
    expect(result.success).toBe(false);
  });
});
