/**
 * Módulo 3 — Digital Presence Score. Cálculo puramente determinístico
 * (sem IA) sobre sinais estruturados já existentes em `companies` —
 * mesmo princípio já usado no Sales Analyst da Fase 7 ("a IA só
 * interpreta números já calculados pelo servidor, nunca calcula os
 * seus próprios"): aqui não há nem IA interpretando, é só uma fórmula
 * de pesos transparente, auditável e testável sem rede.
 *
 * Pesos somam exatamente 100 (ver teste `WEIGHTS soma 100`) — qualquer
 * ajuste futuro de peso deve preservar essa invariante ou documentar
 * explicitamente por que o teto deixou de ser 100.
 */

export const DIGITAL_PRESENCE_WEIGHTS = {
  website: 30,
  email: 15,
  phone: 15,
  socialPlatform: 10,
  maxSocialPlatforms: 4,
} as const;

export interface DigitalPresenceSignals {
  hasWebsite: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  socialPlatformCount: number;
}

export interface DigitalPresenceCriteria {
  weights: typeof DIGITAL_PRESENCE_WEIGHTS;
  signals: DigitalPresenceSignals;
}

export interface DigitalPresenceCompanyInput {
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  socialLinks?: Record<string, string | null | undefined> | null;
}

function extractSignals(company: DigitalPresenceCompanyInput): DigitalPresenceSignals {
  const socialLinks = company.socialLinks ?? {};
  const socialPlatformCount = Object.values(socialLinks).filter((value) => Boolean(value?.trim())).length;

  return {
    hasWebsite: Boolean(company.website?.trim()),
    hasEmail: Boolean(company.email?.trim()),
    hasPhone: Boolean(company.phone?.trim()),
    socialPlatformCount,
  };
}

export interface DigitalPresenceScoreResult {
  score: number;
  criteria: DigitalPresenceCriteria;
}

/** Função pura: mesma entrada, mesma saída, sem I/O — testável sem banco/rede. */
export function computeDigitalPresenceScore(company: DigitalPresenceCompanyInput): DigitalPresenceScoreResult {
  const signals = extractSignals(company);
  const cappedSocialCount = Math.min(signals.socialPlatformCount, DIGITAL_PRESENCE_WEIGHTS.maxSocialPlatforms);

  const score =
    (signals.hasWebsite ? DIGITAL_PRESENCE_WEIGHTS.website : 0) +
    (signals.hasEmail ? DIGITAL_PRESENCE_WEIGHTS.email : 0) +
    (signals.hasPhone ? DIGITAL_PRESENCE_WEIGHTS.phone : 0) +
    cappedSocialCount * DIGITAL_PRESENCE_WEIGHTS.socialPlatform;

  return {
    score: Math.min(score, 100),
    criteria: { weights: DIGITAL_PRESENCE_WEIGHTS, signals },
  };
}
