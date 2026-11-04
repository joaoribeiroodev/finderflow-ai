import "server-only";

/**
 * Preços por 1M tokens (USD), usados só para estimar custo em
 * `ai_usage_events.estimated_cost` — nunca para cobrança real (isso é
 * Fase 6/Asaas). Valores de referência da OpenAI; como mudam com
 * frequência e o provedor não retorna custo na resposta, mantemos uma
 * tabela local explícita em vez de tentar calcular com precisão — ver
 * docs/DECISIONS.md para o registro desta limitação conhecida.
 */
const PRICING_PER_MILLION_TOKENS_USD: Record<string, { input: number; output: number }> = {
  "gpt-5.1": { input: 1.25, output: 10 },
  "gpt-5.1-mini": { input: 0.25, output: 2 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
};

const FALLBACK_PRICING = { input: 0.4, output: 1.6 };

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_PER_MILLION_TOKENS_USD[model] ?? FALLBACK_PRICING;
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
