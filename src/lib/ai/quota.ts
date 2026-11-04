import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Quota de IA (Fase 5, item 2 do prompt mestre): toda chamada de IA deve
 * ser verificada contra uma quota por organização *antes* de chamar o
 * provedor — nunca depois, e nunca "tentar e ver se falha".
 *
 * **Decisão pendente, registrada em docs/DECISIONS.md**: não existe
 * ainda billing/planos reais (Fase 6/Asaas — `plans`/`organization_subscriptions`
 * estão vazias). Por isso usamos um limite mensal padrão (`DEFAULT_MONTHLY_LIMIT`)
 * igual para toda organização, guardado como placeholder em `entitlements`
 * (`metadata.source = "placeholder_default"`). Quando a Fase 6 existir,
 * este valor passa a vir do plano contratado — a lógica de contagem/
 * verificação abaixo não muda, só a origem do limite.
 */
export const AI_QUOTA_FEATURE_KEY = "ai_monthly_requests";
export const DEFAULT_MONTHLY_AI_LIMIT = 50;

export class AIQuotaExceededError extends Error {
  constructor(public readonly limit: number, public readonly used: number) {
    super(
      `Cota mensal de IA da organização atingida (${used}/${limit}). Aguarde o próximo mês ou fale com um administrador sobre o plano.`,
    );
    this.name = "AIQuotaExceededError";
  }
}

export type AIQuotaStatus = {
  limit: number;
  used: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
};

/**
 * Lê (criando se necessário) o registro de quota do mês atual e conta o
 * uso já feito no período. Não consome a quota — isso é feito em
 * `assertWithinQuota`/pelo `AIEngine` após a chamada ter sucesso.
 */
export async function getAIQuotaStatus(
  supabase: Supabase,
  organizationId: string,
): Promise<AIQuotaStatus> {
  const { data: entitlement, error: entitlementError } = await supabase.rpc(
    "get_or_create_ai_quota",
    {
      p_organization_id: organizationId,
      p_feature_key: AI_QUOTA_FEATURE_KEY,
      p_default_limit: DEFAULT_MONTHLY_AI_LIMIT,
    },
  );

  if (entitlementError || !entitlement) {
    logger.error("Falha ao obter/criar quota de IA", {
      error: entitlementError?.message,
      organizationId,
    });
    throw new Error("Não foi possível verificar a cota de IA da organização.");
  }

  const periodStart = entitlement.period_start as string;
  const periodEnd = entitlement.period_end as string;
  const limit = Number(entitlement.limit_value ?? DEFAULT_MONTHLY_AI_LIMIT);

  const { data: used, error: countError } = await supabase.rpc("count_ai_usage_in_period", {
    p_organization_id: organizationId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (countError) {
    logger.error("Falha ao contar uso de IA no período", {
      error: countError.message,
      organizationId,
    });
    throw new Error("Não foi possível verificar o uso de IA da organização.");
  }

  const usedCount = Number(used ?? 0);

  return {
    limit,
    used: usedCount,
    remaining: Math.max(0, limit - usedCount),
    periodStart,
    periodEnd,
  };
}

/**
 * Verifica a quota e lança `AIQuotaExceededError` se esgotada. Chamado
 * pelo `AIEngine` antes de qualquer chamada ao provedor de IA.
 */
export async function assertWithinQuota(
  supabase: Supabase,
  organizationId: string,
): Promise<AIQuotaStatus> {
  const status = await getAIQuotaStatus(supabase, organizationId);
  if (status.remaining <= 0) {
    throw new AIQuotaExceededError(status.limit, status.used);
  }
  return status;
}
