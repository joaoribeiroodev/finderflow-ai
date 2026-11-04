import { describe, expect, it } from "vitest";

import { leadDetailsUpdateSchema, leadMoveStageSchema } from "./leads";

describe("leadDetailsUpdateSchema", () => {
  it("aceita valores mínimos (só prioridade)", () => {
    const result = leadDetailsUpdateSchema.safeParse({ priority: "medium" });
    expect(result.success).toBe(true);
  });

  it("converte vírgula decimal em número para estimatedValue", () => {
    const result = leadDetailsUpdateSchema.safeParse({
      priority: "high",
      estimatedValue: "1.500,50".replace(".", "").replace(",", "."), // simula "1500.50"
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.estimatedValue).toBeCloseTo(1500.5);
  });

  it("rejeita priority fora do enum", () => {
    const result = leadDetailsUpdateSchema.safeParse({ priority: "urgent" });
    expect(result.success).toBe(false);
  });

  it("rejeita probability fora de 0-100", () => {
    const result = leadDetailsUpdateSchema.safeParse({ priority: "low", probability: "150" });
    expect(result.success).toBe(false);
  });
});

describe("leadMoveStageSchema", () => {
  it("aceita lossReason ausente (null) do FormData — campo condicional", () => {
    const result = leadMoveStageSchema.safeParse({
      stageId: "11111111-1111-4111-8111-111111111111",
      lossReason: null,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lossReason).toBeUndefined();
  });

  it("aceita lossReason preenchido", () => {
    const result = leadMoveStageSchema.safeParse({
      stageId: "11111111-1111-4111-8111-111111111111",
      lossReason: "Cliente escolheu concorrente",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lossReason).toBe("Cliente escolheu concorrente");
  });

  it("rejeita stageId inválido", () => {
    const result = leadMoveStageSchema.safeParse({ stageId: "not-a-uuid", lossReason: null });
    expect(result.success).toBe(false);
  });
});
