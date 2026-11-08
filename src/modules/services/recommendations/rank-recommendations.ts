/**
 * Módulo 5 — Recomendação de Serviços.
 *
 * Função pura e determinística para ordenar as oportunidades já geradas
 * pelo Company Analyzer (Fase 5) numa lista agregada entre empresas —
 * nunca uma nova chamada de IA, apenas reordena o que já existe. Mesma
 * regra usada em `computeDigitalPresenceScore` (Módulo 3) e
 * `computeLeadScoreDimensions` (Módulo 4): lógica de negócio
 * determinística fica em uma função pura e testável, separada do acesso
 * a dados.
 */

export type RecommendationPriority = "low" | "medium" | "high";

export interface ServiceRecommendationRow {
  companyId: string;
  companyName: string;
  analysisId: string;
  companyScore: number | null;
  analyzedAt: string;
  serviceId: string | null;
  serviceName: string;
  reason: string;
  priority: RecommendationPriority;
}

const PRIORITY_WEIGHT: Record<RecommendationPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Ordena por prioridade (alta → baixa) e, dentro da mesma prioridade,
 * pelo placar de potencial da empresa (`company_score`, do próprio
 * Company Analyzer) em ordem decrescente — prioriza as combinações
 * empresa+serviço mais promissoras no topo da lista.
 */
export function rankRecommendations(rows: ServiceRecommendationRow[]): ServiceRecommendationRow[] {
  return [...rows].sort((a, b) => {
    const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return (b.companyScore ?? 0) - (a.companyScore ?? 0);
  });
}

export interface ServiceRecommendationSummaryEntry {
  serviceId: string | null;
  serviceName: string;
  count: number;
  highPriorityCount: number;
}

/** Agrupa por serviço para o resumo no topo da página (contagem total e quantas são de prioridade alta). */
export function summarizeByService(rows: ServiceRecommendationRow[]): ServiceRecommendationSummaryEntry[] {
  const byKey = new Map<string, ServiceRecommendationSummaryEntry>();

  for (const row of rows) {
    const key = row.serviceId ?? `name:${row.serviceName}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      if (row.priority === "high") existing.highPriorityCount += 1;
    } else {
      byKey.set(key, {
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        count: 1,
        highPriorityCount: row.priority === "high" ? 1 : 0,
      });
    }
  }

  return [...byKey.values()].sort((a, b) => b.count - a.count);
}
