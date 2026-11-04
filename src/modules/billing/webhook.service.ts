import "server-only";

import { timingSafeEqual } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AsaasProvider } from "@/lib/billing/provider";
import { restrictAiEntitlement, upsertAiMonthlyEntitlement, planAiMonthlyLimit } from "@/lib/billing/entitlements";
import { mapAsaasSubscriptionStatus, type AsaasPaymentStatus } from "@/lib/billing/status";
import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

/**
 * Comparação resistente a timing attack para o token do webhook
 * (`asaas-access-token`, confirmado em
 * docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook
 * durante a implementação). Nunca loga nenhum dos dois valores.
 */
export function verifyAsaasWebhookToken(receivedHeader: string | null, expectedToken: string): boolean {
  if (!receivedHeader) return false;
  const received = Buffer.from(receivedHeader);
  const expected = Buffer.from(expectedToken);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

interface AsaasPaymentPayload {
  object?: string;
  id?: string;
  customer?: string;
  subscription?: string;
  value?: number;
  status?: string;
  dueDate?: string;
  paymentDate?: string | null;
  invoiceUrl?: string;
}

interface AsaasSubscriptionPayload {
  object?: string;
  id?: string;
  status?: "ACTIVE" | "EXPIRED" | "INACTIVE";
  value?: number;
  cycle?: string;
  nextDueDate?: string;
  checkoutSession?: string;
  deleted?: boolean;
}

export interface AsaasWebhookPayload {
  id?: string;
  event?: string;
  dateCreated?: string;
  payment?: AsaasPaymentPayload;
  subscription?: AsaasSubscriptionPayload;
  [key: string]: unknown;
}

export type WebhookProcessingOutcome =
  | { httpStatus: 200 | 400; reason: string }
  | { httpStatus: 500; reason: string };

/**
 * Processa um evento de webhook do Asaas de ponta a ponta — idempotente
 * via `claim_asaas_webhook_event` (migration 20261104200000), com toda
 * leitura/escrita usando o cliente admin (sem sessão de usuário aqui,
 * por design — docs/05-integrations.md §5.2 "Webhook").
 */
export async function processAsaasWebhookEvent(
  admin: AdminClient,
  provider: AsaasProvider,
  payload: AsaasWebhookPayload,
): Promise<WebhookProcessingOutcome> {
  if (!payload.id || !payload.event) {
    return { httpStatus: 400, reason: "payload sem id/event" };
  }

  const { data: claimRows, error: claimError } = await admin.rpc("claim_asaas_webhook_event", {
    p_provider_event_id: payload.id,
    p_event_type: payload.event,
    p_payload: payload as never,
  });

  if (claimError) {
    logger.error("Falha ao reivindicar evento de webhook do Asaas", { error: claimError.message });
    return { httpStatus: 500, reason: "falha ao registrar evento" };
  }

  const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
  if (!claim?.claimed) {
    // Já processado (ou ignorado) anteriormente — responde 200 sem
    // reaplicar nenhum efeito. Entrega "at least once" é esperada.
    return { httpStatus: 200, reason: "evento já processado" };
  }

  const eventId = claim.event_id as string;

  try {
    await applyWebhookEvent(admin, provider, payload);
    await admin
      .from("asaas_webhook_events")
      .update({ processing_status: "processed", processed_at: new Date().toISOString() })
      .eq("id", eventId);
    return { httpStatus: 200, reason: "processado" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    logger.error("Falha ao processar evento de webhook do Asaas", {
      error: message,
      eventType: payload.event,
      eventId,
    });
    await admin
      .from("asaas_webhook_events")
      .update({ processing_status: "failed", error_message: message })
      .eq("id", eventId);
    return { httpStatus: 500, reason: "falha ao processar — será reentregue" };
  }
}

async function applyWebhookEvent(
  admin: AdminClient,
  provider: AsaasProvider,
  payload: AsaasWebhookPayload,
): Promise<void> {
  const externalSubscriptionId = payload.subscription?.id ?? payload.payment?.subscription ?? null;

  if (!externalSubscriptionId) {
    // Evento não ligado a uma assinatura (ex.: cobrança avulsa, transferência).
    // Fora do escopo do billing do FinderFlow — ignorado, não é erro.
    await markIgnored(admin, payload.id!);
    return;
  }

  const localSubscription = await findLocalSubscription(
    admin,
    externalSubscriptionId,
    payload.subscription?.checkoutSession ?? null,
  );

  if (!localSubscription) {
    logger.warn("Webhook do Asaas referencia assinatura sem correspondência local", {
      externalSubscriptionId,
      eventType: payload.event,
    });
    await markIgnored(admin, payload.id!);
    return;
  }

  // Preferimos o objeto `subscription` do próprio payload (evita uma
  // chamada de rede por evento); só consultamos a API quando o evento é
  // só de pagamento (payload sem `subscription`) — nesse caso o estado
  // canônico da assinatura não veio no corpo do webhook.
  let asaasStatus = payload.subscription?.status ?? null;
  let deleted = payload.subscription?.deleted ?? false;
  let nextDueDate = payload.subscription?.nextDueDate ?? null;

  if (!payload.subscription) {
    const snapshot = await provider.getSubscription(externalSubscriptionId);
    if (snapshot.status === "ok" && snapshot.data) {
      asaasStatus = snapshot.data.status;
      deleted = snapshot.data.deleted;
      nextDueDate = snapshot.data.nextDueDate;
    } else if (snapshot.status === "not_found") {
      deleted = true;
    } else {
      throw new Error(snapshot.errorMessage ?? "Não foi possível confirmar o estado da assinatura no Asaas.");
    }
  }

  const latestPaymentStatus = (payload.payment?.status as AsaasPaymentStatus) ?? null;
  const mappedStatus = mapAsaasSubscriptionStatus({
    asaasStatus: asaasStatus ?? "INACTIVE",
    deleted,
    latestPaymentStatus,
  });

  const subscriptionUpdate: Database["public"]["Tables"]["organization_subscriptions"]["Update"] = {
    status: mappedStatus,
    external_subscription_id: externalSubscriptionId,
  };
  if (nextDueDate) {
    subscriptionUpdate.next_due_date = nextDueDate.slice(0, 10);
    subscriptionUpdate.current_period_end = nextDueDate;
  }
  if (mappedStatus === "canceled") {
    subscriptionUpdate.canceled_at = new Date().toISOString();
  }

  const { error: updateError } = await admin
    .from("organization_subscriptions")
    .update(subscriptionUpdate)
    .eq("id", localSubscription.id);
  if (updateError) throw new Error(`Falha ao atualizar assinatura local: ${updateError.message}`);

  if (payload.payment?.id) {
    await upsertBillingPayment(admin, localSubscription, payload.payment);
  }

  await auditWebhookEvent(admin, localSubscription, payload, mappedStatus);
  await syncEntitlementsForStatus(admin, localSubscription.organization_id, localSubscription.plan_id, mappedStatus);
}

async function findLocalSubscription(
  admin: AdminClient,
  externalSubscriptionId: string,
  checkoutSessionId: string | null,
) {
  const byExternalId = await admin
    .from("organization_subscriptions")
    .select("id, organization_id, plan_id, status")
    .eq("external_subscription_id", externalSubscriptionId)
    .maybeSingle();

  if (byExternalId.data) return byExternalId.data;

  if (checkoutSessionId) {
    const byCheckout = await admin
      .from("organization_subscriptions")
      .select("id, organization_id, plan_id, status")
      .eq("external_checkout_id", checkoutSessionId)
      .maybeSingle();
    if (byCheckout.data) return byCheckout.data;
  }

  return null;
}

async function markIgnored(admin: AdminClient, providerEventId: string) {
  await admin
    .from("asaas_webhook_events")
    .update({ processing_status: "ignored", processed_at: new Date().toISOString() })
    .eq("provider_event_id", providerEventId);
}

async function upsertBillingPayment(
  admin: AdminClient,
  localSubscription: { id: string; organization_id: string },
  payment: NonNullable<AsaasWebhookPayload["payment"]>,
) {
  const isPaid = payment.status === "CONFIRMED" || payment.status === "RECEIVED";

  const { error } = await admin.from("billing_payments").upsert(
    {
      organization_id: localSubscription.organization_id,
      subscription_id: localSubscription.id,
      provider: "asaas",
      external_payment_id: payment.id!,
      amount: payment.value ?? 0,
      status: payment.status ?? "UNKNOWN",
      due_date: payment.dueDate ?? null,
      paid_at: isPaid ? payment.paymentDate ?? new Date().toISOString() : null,
      invoice_url: payment.invoiceUrl ?? null,
    },
    { onConflict: "provider,external_payment_id" },
  );

  if (error) throw new Error(`Falha ao gravar cobrança: ${error.message}`);
}

async function auditWebhookEvent(
  admin: AdminClient,
  localSubscription: { id: string; organization_id: string },
  payload: AsaasWebhookPayload,
  mappedStatus: string,
) {
  const { error } = await admin.from("audit_logs").insert({
    organization_id: localSubscription.organization_id,
    actor_id: null,
    action: `billing.webhook.${payload.event}`,
    resource_type: "organization_subscription",
    resource_id: localSubscription.id,
    metadata: { event_id: payload.id, event_type: payload.event, mapped_status: mappedStatus },
  });

  if (error) {
    // Auditoria não deve derrubar o processamento do webhook — só registrar o problema.
    logger.error("Falha ao gravar audit_log de webhook do Asaas", { error: error.message });
  }
}

async function syncEntitlementsForStatus(
  admin: AdminClient,
  organizationId: string,
  planId: string,
  mappedStatus: string,
) {
  if (mappedStatus === "active") {
    const { data: plan } = await admin.from("plans").select("limits").eq("id", planId).maybeSingle();
    const limit = plan ? planAiMonthlyLimit(plan.limits) : null;
    await upsertAiMonthlyEntitlement(admin, organizationId, limit ?? 0, "plan");
    return;
  }

  if (mappedStatus === "suspended" || mappedStatus === "canceled" || mappedStatus === "expired") {
    await restrictAiEntitlement(admin, organizationId);
  }
  // `incomplete`/`trialing`/`past_due`: mantém o entitlement do mês como
  // está (nem concede antes da confirmação, nem restringe durante a
  // tolerância comercial — ver src/lib/billing/status.ts).
}
