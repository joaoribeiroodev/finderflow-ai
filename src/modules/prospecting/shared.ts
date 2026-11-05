import "server-only";

/**
 * Compartilhado entre `actions.ts` (busca em tempo real) e
 * `history.service.ts` (histórico, reconstruído a partir do que já
 * está salvo em `search_results` — sem nova chamada ao provedor).
 */
export function buildAttributionLabel(attribution: Record<string, unknown>): string {
  const source = typeof attribution.source === "string" ? attribution.source : undefined;
  const via = typeof attribution.via === "string" ? attribution.via : undefined;
  if (source && via) return `Dados: ${source} (via ${via})`;
  return source ?? via ?? "Dados de provedor externo";
}
