import { describe, expect, it } from "vitest";

import { DIGITAL_PRESENCE_WEIGHTS, computeDigitalPresenceScore } from "./digital-presence-score";

describe("DIGITAL_PRESENCE_WEIGHTS", () => {
  it("soma 100 no caso de cobertura máxima (invariante do score 0-100)", () => {
    const max =
      DIGITAL_PRESENCE_WEIGHTS.website +
      DIGITAL_PRESENCE_WEIGHTS.email +
      DIGITAL_PRESENCE_WEIGHTS.phone +
      DIGITAL_PRESENCE_WEIGHTS.socialPlatform * DIGITAL_PRESENCE_WEIGHTS.maxSocialPlatforms;
    expect(max).toBe(100);
  });
});

describe("computeDigitalPresenceScore", () => {
  it("retorna 0 para uma empresa sem nenhum sinal", () => {
    const { score, criteria } = computeDigitalPresenceScore({});
    expect(score).toBe(0);
    expect(criteria.signals).toEqual({
      hasWebsite: false,
      hasEmail: false,
      hasPhone: false,
      socialPlatformCount: 0,
    });
  });

  it("retorna 100 quando todos os sinais estão presentes (com folga nas redes)", () => {
    const { score } = computeDigitalPresenceScore({
      website: "https://example.com",
      email: "contato@example.com",
      phone: "+5511987654321",
      socialLinks: { instagram: "a", facebook: "b", linkedin: "c", tiktok: "d" },
    });
    expect(score).toBe(100);
  });

  it("soma parcial corretamente quando só alguns sinais existem", () => {
    const { score } = computeDigitalPresenceScore({ website: "example.com", email: null, phone: undefined });
    expect(score).toBe(DIGITAL_PRESENCE_WEIGHTS.website);
  });

  it("ignora strings em branco como se o campo não existisse", () => {
    const { score } = computeDigitalPresenceScore({ website: "   ", email: "", phone: "  " });
    expect(score).toBe(0);
  });

  it("limita a contribuição de redes sociais ao teto configurado, mesmo com mais plataformas", () => {
    const { score, criteria } = computeDigitalPresenceScore({
      socialLinks: { instagram: "a", facebook: "b", linkedin: "c", tiktok: "d", youtube: "e", twitter: "f" },
    });
    expect(criteria.signals.socialPlatformCount).toBe(6);
    expect(score).toBe(DIGITAL_PRESENCE_WEIGHTS.socialPlatform * DIGITAL_PRESENCE_WEIGHTS.maxSocialPlatforms);
  });

  it("não conta chave de rede social com valor vazio/nulo", () => {
    const { score } = computeDigitalPresenceScore({
      socialLinks: { instagram: "", facebook: null, linkedin: undefined, tiktok: "@real" },
    });
    expect(score).toBe(DIGITAL_PRESENCE_WEIGHTS.socialPlatform);
  });

  it("nunca excede 100 mesmo com entradas hipotéticas acima do esperado", () => {
    const { score } = computeDigitalPresenceScore({
      website: "a",
      email: "b",
      phone: "c",
      socialLinks: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`platform_${i}`, "x"])),
    });
    expect(score).toBe(100);
  });
});
