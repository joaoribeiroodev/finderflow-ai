import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AI_QUOTA_FEATURE_KEY } from "@/lib/ai/quota";
import { logger } from "@/lib/logger/logger";
import type { Database, Json } from "@/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Recalcula `entitlements.ai_monthly_requests` a partir do plano
 * contratado (Fase 6) — fecha o placeholder documentado na Fase 5
 * (`get_or_create_ai_quota` só usa `DEFAULT_MONTHLY_AI_LIMIT` quando
 * **não existe** linha para o mês corrente; se o billing já escreveu a
 * linha com o limite real do plano, a RPC de quota passa a usar esse
 * valor sem precisar de nenhuma mudança nela — ver docs/DECISIONS.md).
 *
 * Alinhado ao mesmo limite de período usado por `get_or_create_ai_quota`
 * (`date_trunc('month', now())`), para que as duas linhas sempre colidam
 * na mesma chave `(organization_id, feature_key, period_start)`.
 */

export function currentCalendarMonthBounds(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/** Lê `limits.ai_monthly_requests` do plano; `null` se ausente/malformado — nunca lança. */
export function planAiMonthlyLimit(limits: Json): number | null {
  if (!limits || typeof limits !== "object" || Array.isArray(limits)) return null;
  const value = (limits as Record<string, Json>)[AI_QUOTA_FEATURE_KEY];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Aplica (ou restringe) o limite mensal de IA da organização para o mês
 * corrente. Usa o cliente passado como veio (admin no webhook/job de
 * sincronização — nenhuma sessão de usuário ali) — nunca confiado com
 * `organization_id` vindo do browser.
 */
export async function upsertAiMonthlyEntitlement(
  supabase: Supabase,
  organizationId: string,
  limitValue: number,
  source: "plan" | "billing_restricted",
): Promise<void> {
  const { start, end } = currentCalendarMonthBounds();

  const { error } = await supabase.from("entitlements").upsert(
    {
      organization_id: organizationId,
      feature_key: AI_QUOTA_FEATURE_KEY,
      limit_value: limitValue,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      metadata: { source },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,feature_key,period_start" },
  );

  if (error) {
    logger.error("Falha ao atualizar entitlement de IA a partir do billing", {
      error: error.message,
      organizationId,
      limitValue,
      source,
    });
  }
}

/** Restringe o recurso pago (IA) sem apagar nenhum dado — regra explícita do prompt mestre (§5.2 "Inadimplência e cancelamento"). */
export async function restrictAiEntitlement(supabase: Supabase, organizationId: string): Promise<void> {
  await upsertAiMonthlyEntitlement(supabase, organizationId, 0, "billing_restricted");
}
