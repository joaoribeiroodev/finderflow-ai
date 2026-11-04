import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

import type { PlanRow } from "./plans.service";

type Supabase = SupabaseClient<Database>;

export type SubscriptionRow = Database["public"]["Tables"]["organization_subscriptions"]["Row"];
export type BillingPaymentRow = Database["public"]["Tables"]["billing_payments"]["Row"];

export interface CurrentSubscription {
  subscription: SubscriptionRow;
  plan: PlanRow | null;
}

/**
 * Assinatura "atual" da organização: a mais recente que não seja um
 * registro morto. Como o índice único parcial do banco
 * (`subscriptions_one_current_per_org_idx`) só permite **uma** linha em
 * estado não-terminal por organização por vez, pegar a mais recente por
 * `created_at` entre todas (inclusive `canceled`/`expired`) é seguro e
 * mostra o histórico mesmo após cancelamento.
 */
export async function getCurrentSubscription(
  supabase: Supabase,
  organizationId: string,
): Promise<CurrentSubscription | null> {
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .select("*, plans(*)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao buscar assinatura atual", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar os dados da assinatura.");
  }

  if (!data) return null;

  const { plans, ...subscription } = data as SubscriptionRow & { plans: PlanRow | null };
  return { subscription, plan: plans };
}

export async function listPaymentHistory(
  supabase: Supabase,
  organizationId: string,
): Promise<BillingPaymentRow[]> {
  const { data, error } = await supabase
    .from("billing_payments")
    .select("*")
    .eq("organization_id", organizationId)
    .order("due_date", { ascending: false })
    .limit(24);

  if (error) {
    logger.error("Falha ao listar histórico de cobranças", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar o histórico de cobranças.");
  }

  return data ?? [];
}
