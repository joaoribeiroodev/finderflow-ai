/**
 * Mapeamento de estado do Asaas -> `subscription_status` interno
 * (`incomplete | trialing | active | past_due | suspended | canceled | expired`,
 * enum já criado na Fase 0/1 — docs/03-database.md).
 *
 * O Asaas não expõe um único campo "status da assinatura" que cubra tudo
 * que o prompt mestre pede: o objeto `subscription` só tem
 * `status: ACTIVE|EXPIRED|INACTIVE` (confirmado em
 * docs.asaas.com/reference/create-new-subscription durante a
 * implementação) — o estado "está pago este mês?" vem do último evento
 * de pagamento (`payment.status`), não da assinatura. Por isso a função
 * combina os dois, em vez de confiar só no status da assinatura.
 *
 * Isto é lógica de negócio pura e testável sem rede/banco — nenhuma
 * chamada à API do Asaas aqui.
 */

import type { AsaasSubscriptionStatus } from "./provider";

export type InternalSubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled"
  | "expired";

/** Subconjunto de `payment.status` relevante para o mapeamento (ver docs.asaas.com/docs/payment-events). */
export type AsaasPaymentStatus =
  | "CONFIRMED"
  | "RECEIVED"
  | "OVERDUE"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "REFUND_IN_PROGRESS"
  | "DELETED"
  | string
  | null;

export function mapAsaasSubscriptionStatus(input: {
  asaasStatus: AsaasSubscriptionStatus;
  deleted: boolean;
  latestPaymentStatus: AsaasPaymentStatus;
}): InternalSubscriptionStatus {
  const { asaasStatus, deleted, latestPaymentStatus } = input;

  if (deleted) return "canceled";
  if (asaasStatus === "EXPIRED") return "expired";

  if (asaasStatus === "INACTIVE") {
    return latestPaymentStatus === "OVERDUE" ? "past_due" : "suspended";
  }

  // asaasStatus === "ACTIVE"
  switch (latestPaymentStatus) {
    case "CONFIRMED":
    case "RECEIVED":
      return "active";
    case "OVERDUE":
      return "past_due";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
    case "REFUND_IN_PROGRESS":
      // Reembolso de uma cobrança isolada não cancela a assinatura em si
      // (o Asaas mantém `status: ACTIVE` na assinatura) — tratamos como
      // ativa e deixamos o histórico de pagamentos (`billing_payments`)
      // refletir o reembolso individualmente. Revisão de negócio pendente
      // se isso deve suspender automaticamente — documentado em DECISIONS.md.
      return "active";
    case null:
    case "DELETED":
      // Assinatura criada mas ainda sem pagamento confirmado.
      return "incomplete";
    default:
      return "incomplete";
  }
}

/** Dias de tolerância comercial após `PAYMENT_OVERDUE` antes de suspender recursos pagos (docs/05-integrations.md §5.2 "Inadimplência e cancelamento"). Placeholder de negócio — ver DECISIONS.md. */
export const PAST_DUE_GRACE_DAYS = 5;

export function isGraceExpired(pastDueSince: Date, now: Date = new Date()): boolean {
  const graceMs = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - pastDueSince.getTime() > graceMs;
}
