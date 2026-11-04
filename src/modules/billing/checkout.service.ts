import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env/env.server";
import type { AsaasProvider } from "@/lib/billing/provider";
import { logger } from "@/lib/logger/logger";
import type { BillingProfileInput } from "@/lib/validation/document";
import type { Database } from "@/types/database";

import { getPlanById } from "./plans.service";

type Supabase = SupabaseClient<Database>;

export class PlanNotFoundError extends Error {
  constructor() {
    super("Plano não encontrado ou inativo.");
    this.name = "PlanNotFoundError";
  }
}

export class SubscriptionAlreadyActiveError extends Error {
  constructor() {
    super(
      "Esta organização já tem uma assinatura em andamento. Cancele-a antes de assinar outro plano, ou aguarde a confirmação do pagamento atual.",
    );
    this.name = "SubscriptionAlreadyActiveError";
  }
}

export class AsaasRequestFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsaasRequestFailedError";
  }
}

function formatAsaasDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Inicia o checkout recorrente de um plano (docs/05-integrations.md §5.2,
 * fluxo recomendado itens 1-5). Nunca aceita preço do cliente — o preço
 * sempre vem do registro de `plans` resolvido aqui no servidor.
 *
 * Pressupõe que o chamador (Server Action) já revalidou
 * `assertCanAdminOrganization` — mas a policy de insert de
 * `organization_subscriptions` (`can_admin_org`) também protege via RLS,
 * defesa em profundidade.
 */
export async function startCheckout(
  supabase: Supabase,
  provider: AsaasProvider,
  organizationId: string,
  planId: string,
  billingProfile: BillingProfileInput,
): Promise<{ checkoutUrl: string }> {
  const plan = await getPlanById(supabase, planId);
  if (!plan || !plan.is_active) throw new PlanNotFoundError();

  // 1. Persistir o perfil de faturamento (nunca dado de cartão — apenas
  // o necessário para cadastrar o customer no Asaas).
  const { error: orgUpdateError } = await supabase
    .from("organizations")
    .update({
      billing_name: billingProfile.billingName,
      billing_document: billingProfile.billingDocument,
      billing_email: billingProfile.billingEmail,
    })
    .eq("id", organizationId);

  if (orgUpdateError) {
    logger.error("Falha ao salvar perfil de faturamento", {
      error: orgUpdateError.message,
      organizationId,
    });
    throw new Error("Não foi possível salvar os dados de faturamento.");
  }

  // 2. Reaproveitar o customer do Asaas já criado para esta organização,
  // se existir (evita duplicar cadastro de cliente a cada tentativa de
  // assinatura — ver docs/DECISIONS.md).
  const { data: previousSubscription } = await supabase
    .from("organization_subscriptions")
    .select("external_customer_id")
    .eq("organization_id", organizationId)
    .not("external_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let externalCustomerId = previousSubscription?.external_customer_id ?? null;

  if (!externalCustomerId) {
    const customerResult = await provider.createCustomer({
      name: billingProfile.billingName,
      cpfCnpj: billingProfile.billingDocument,
      email: billingProfile.billingEmail,
      externalReference: organizationId,
    });

    if (customerResult.status !== "ok" || !customerResult.data) {
      throw new AsaasRequestFailedError(
        customerResult.errorMessage ?? "Não foi possível cadastrar o cliente no Asaas.",
      );
    }
    externalCustomerId = customerResult.data.externalCustomerId;
  }

  // 3. Criar a linha local em `incomplete` ANTES de chamar o Asaas — o
  // índice único parcial (`subscriptions_one_current_per_org_idx`) impede
  // duas assinaturas não-terminais simultâneas para a mesma organização;
  // capturamos a violação como "já existe uma assinatura em andamento".
  const { data: subscriptionRow, error: insertError } = await supabase
    .from("organization_subscriptions")
    .insert({
      organization_id: organizationId,
      plan_id: plan.id,
      provider: "asaas",
      external_customer_id: externalCustomerId,
      status: "incomplete",
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new SubscriptionAlreadyActiveError();
    }
    logger.error("Falha ao criar assinatura local", { error: insertError.message, organizationId });
    throw new Error("Não foi possível iniciar a assinatura.");
  }

  // 4. Criar o checkout hospedado no Asaas para cobrança recorrente.
  const env = getServerEnv();
  const nextDueDate = formatAsaasDateTime(new Date());
  const returnBase = `${env.NEXT_PUBLIC_APP_URL}/billing/return`;

  const checkoutResult = await provider.createSubscriptionCheckout({
    externalCustomerId,
    planName: plan.name,
    planDescription: plan.description,
    value: Number(plan.price),
    cycle: "MONTHLY",
    nextDueDate,
    externalReference: subscriptionRow.id,
    callback: {
      successUrl: `${returnBase}?subscription=${subscriptionRow.id}&result=success`,
      cancelUrl: `${returnBase}?subscription=${subscriptionRow.id}&result=cancel`,
      expiredUrl: `${returnBase}?subscription=${subscriptionRow.id}&result=expired`,
    },
  });

  if (checkoutResult.status !== "ok" || !checkoutResult.data) {
    // Limpa a linha `incomplete` que não vai a lugar nenhum, para não
    // travar o índice único e impedir uma nova tentativa.
    await supabase.from("organization_subscriptions").delete().eq("id", subscriptionRow.id);
    throw new AsaasRequestFailedError(
      checkoutResult.errorMessage ?? "Não foi possível criar o checkout no Asaas.",
    );
  }

  const { error: updateError } = await supabase
    .from("organization_subscriptions")
    .update({ external_checkout_id: checkoutResult.data.externalCheckoutId })
    .eq("id", subscriptionRow.id);

  if (updateError) {
    logger.error("Falha ao gravar id do checkout na assinatura", {
      error: updateError.message,
      organizationId,
      subscriptionId: subscriptionRow.id,
    });
  }

  return { checkoutUrl: checkoutResult.data.checkoutUrl };
}
