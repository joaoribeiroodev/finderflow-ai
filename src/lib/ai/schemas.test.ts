import { describe, expect, it } from "vitest";

import { LEAD_SCORE_CRITERIA, companyAnalysisSchema, leadScoreSchema, outreachMessageSchema } from "./schemas";

describe("companyAnalysisSchema", () => {
  const valid = {
    summary: "Empresa com bom potencial.",
    observations: [
      { claim: "Não tem website", evidence: "Campo website vazio", source: "cadastro", confidence: "medium", kind: "inference" },
    ],
    opportunities: [
      { service_id: null, service_name: "Criação de site", reason: "Sem presença digital", priority: "high" },
    ],
    recommended_action: "Agendar contato.",
    score: 70,
    score_breakdown: [{ criterion: "presença digital", weight: 30, score: 40, rationale: "sem site" }],
  };

  it("aceita um payload completo e válido", () => {
    const result = companyAnalysisSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejeita score fora do intervalo 0-100", () => {
    const result = companyAnalysisSchema.safeParse({ ...valid, score: 150 });
    expect(result.success).toBe(false);
  });

  it("rejeita confidence fora do enum", () => {
    const invalid = {
      ...valid,
      observations: [{ ...valid.observations[0], confidence: "certeza_total" }],
    };
    const result = companyAnalysisSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejeita kind fora de fact|inference", () => {
    const invalid = { ...valid, observations: [{ ...valid.observations[0], kind: "opinion" }] };
    const result = companyAnalysisSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("leadScoreSchema", () => {
  const validBreakdown = LEAD_SCORE_CRITERIA.map((c) => ({
    criterion: c.key,
    score: 50,
    rationale: "justificativa",
  }));

  const valid = {
    summary: "Lead moderadamente qualificado.",
    score_breakdown: validBreakdown,
    score: 50,
    recommended_action: "Agendar follow-up.",
  };

  it("aceita payload com todos os 6 critérios fixos", () => {
    const result = leadScoreSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejeita quando falta um critério (tamanho != 6)", () => {
    const result = leadScoreSchema.safeParse({ ...valid, score_breakdown: validBreakdown.slice(0, 5) });
    expect(result.success).toBe(false);
  });

  it("rejeita critério fora da lista fixa de critérios de negócio", () => {
    const invalid = {
      ...valid,
      score_breakdown: [...validBreakdown.slice(0, 5), { criterion: "chute_aleatorio", score: 10, rationale: "x" }],
    };
    const result = leadScoreSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejeita score final fora de 0-100", () => {
    const result = leadScoreSchema.safeParse({ ...valid, score: -5 });
    expect(result.success).toBe(false);
  });

  it("soma dos pesos dos critérios fixos é 100 (regra de negócio do lead scoring)", () => {
    const total = LEAD_SCORE_CRITERIA.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBe(100);
  });
});

describe("outreachMessageSchema", () => {
  const valid = {
    channel: "email",
    subject: "Proposta de parceria",
    message: "Olá, tudo bem?",
    tone: "consultivo",
    follow_up_suggestion: "Enviar follow-up em 3 dias.",
  };

  it("aceita um rascunho válido", () => {
    expect(outreachMessageSchema.safeParse(valid).success).toBe(true);
  });

  it("aceita subject nulo (ex.: canal whatsapp sem assunto)", () => {
    const result = outreachMessageSchema.safeParse({ ...valid, channel: "whatsapp", subject: null });
    expect(result.success).toBe(true);
  });

  it("rejeita canal fora do enum permitido", () => {
    const result = outreachMessageSchema.safeParse({ ...valid, channel: "sms" });
    expect(result.success).toBe(false);
  });

  it("rejeita mensagem vazia", () => {
    const result = outreachMessageSchema.safeParse({ ...valid, message: "" });
    expect(result.success).toBe(false);
  });
});
