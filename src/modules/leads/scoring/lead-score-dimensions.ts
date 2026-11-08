import { LEAD_SCORE_CRITERIA, type LeadScoreResult } from "@/lib/ai/schemas";

/**
 * Módulo 4 — Lead Scoring 2.0. Decompõe o placar único de 6 critérios do
 * Lead Scorer (Fase 5) em 3 dimensões — nunca uma nova chamada de IA:
 * é só uma reagregação determinística dos mesmos números que a IA já
 * devolveu em `score_breakdown`, usando os pesos já estabelecidos em
 * `LEAD_SCORE_CRITERIA`. Cada critério pertence a exatamente uma
 * dimensão:
 *
 * - **Potencial** (tamanho da oportunidade): `service_fit` (quão bem o
 *   serviço atende) + `observable_need` (evidência observável de
 *   necessidade).
 * - **Aderência** (fit com o perfil ideal): `icp_fit` (aderência ao ICP)
 *   + `data_quality` (confiabilidade do que sabemos sobre a empresa —
 *   afeta a confiança na própria avaliação de aderência).
 * - **Prioridade** (agir agora): `contact_ease` (facilidade de contato)
 *   + `interest_signals` (sinais de interesse recentes).
 */
export const LEAD_SCORE_DIMENSIONS = {
  potential: { label: "Potencial", criteria: ["service_fit", "observable_need"] },
  fit: { label: "Aderência", criteria: ["icp_fit", "data_quality"] },
  priority: { label: "Prioridade", criteria: ["contact_ease", "interest_signals"] },
} as const satisfies Record<string, { label: string; criteria: readonly string[] }>;

export interface LeadScoreDimensions {
  potentialScore: number;
  fitScore: number;
  priorityScore: number;
}

const WEIGHT_BY_CRITERION: Record<string, number> = Object.fromEntries(
  LEAD_SCORE_CRITERIA.map((criterion) => [criterion.key, criterion.weight]),
);

function dimensionScore(breakdown: LeadScoreResult["score_breakdown"], criteria: readonly string[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const item of breakdown) {
    if (!criteria.includes(item.criterion)) continue;
    const weight = WEIGHT_BY_CRITERION[item.criterion] ?? 0;
    weightedSum += item.score * weight;
    totalWeight += weight;
  }

  // Nunca deveria acontecer em produção (score_breakdown é validado pelo Zod
  // contra exatamente os mesmos critérios), mas evita divisão por zero.
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

/** Função pura: mesma entrada, mesma saída, sem I/O — testável sem banco/rede/IA. */
export function computeLeadScoreDimensions(breakdown: LeadScoreResult["score_breakdown"]): LeadScoreDimensions {
  return {
    potentialScore: dimensionScore(breakdown, LEAD_SCORE_DIMENSIONS.potential.criteria),
    fitScore: dimensionScore(breakdown, LEAD_SCORE_DIMENSIONS.fit.criteria),
    priorityScore: dimensionScore(breakdown, LEAD_SCORE_DIMENSIONS.priority.criteria),
  };
}
