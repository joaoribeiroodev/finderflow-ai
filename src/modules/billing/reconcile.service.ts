import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AsaasProvider } from "@/lib/billing/provider";
import { restrictAiEntitlement } from "@/lib/billing/entitlements";
import { isGraceExpired } from "@/lib/billing/status";
import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

/**
 * Reconciliação periódica (docs/05-integrations.md §5.2: "Reconciliar
 * periodicamente estado interno com consulta API quando houver falhas de
 * webhook" + "Inadimplência e cancelamento" — período de tolerância).
 *
 * **Escopo deliberadamente limitado** (ver docs/DECISIONS.md): sem um
 * evento de pagamento, não há como este job inferir com segurança se uma
 * assinatura `ACTIVE` no Asaas está de fato paga este mês ou não — essa
 * informação só vem no payload do webhook de pagamento. Recomputar o
 * status local a partir só do status da assinatura regrediria uma
 * assinatura `active` para `incomplete` incorretamente. Por isso este job
 * só corrige as duas transições que SÃO seguras de inferir sem contexto
 * de pagamento:
 *
 * 1. A assinatura foi removida/expirou no Asaas (webhook de cancelamento
 *    pode ter se perdido) -> sincroniza para `canceled`/`expired` aqui.
 * 2. Uma assinatura em `past_due` ultrapassou a tolerância comercial
 *    (`PAST_DUE_GRACE_DAYS`) -> suspende recursos pagos sem apagar dados.
 *
 * Não há agendador real neste ambiente — este handler precisa ser
 * chamado por um scheduler externo (Vercel Cron, GitHub Actions, etc.)
 * configurado para enviar `Authorization: Bearer ${CRON_SECRET}`.
 */
export interface ReconcileSummary {
  checked: number;
  canceledOrExpired: number;
  suspendedForGrace: number;
  providerErrors: number;
}

export async function reconcileSubscriptions(
  admin: AdminClient,
  provider: AsaasProvider,
): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    checked: 0,
    canceledOrExpired: 0,
    suspendedForGrace: 0,
    providerErrors: 0,
  };

  const { data: rows, error } = await admin
    .from("organization_subscriptions")
    .select("id, organization_id, external_subscription_id, status, updated_at")
    .in("status", ["active", "past_due", "incomplete"]);

  if (error) {
    logger.error("Falha ao listar assinaturas para reconciliação", { error: error.message });
    throw new Error("Falha ao listar assinaturas para reconciliação.");
  }

  for (const row of rows ?? []) {
    summary.checked += 1;

    if (row.status === "past_due") {
      const pastDueSince = new Date(row.updated_at);
      if (isGraceExpired(pastDueSince)) {
        await admin
          .from("organization_subscriptions")
          .update({ status: "suspended" })
          .eq("id", row.id);
        await restrictAiEntitlement(admin, row.organization_id);
        await admin.from("audit_logs").insert({
          organization_id: row.organization_id,
          actor_id: null,
          action: "billing.grace_period_expired",
          resource_type: "organization_subscription",
          resource_id: row.id,
          metadata: { past_due_since: row.updated_at },
        });
        summary.suspendedForGrace += 1;
        continue;
      }
    }

    if (!row.external_subscription_id) continue;

    const snapshot = await provider.getSubscription(row.external_subscription_id);
    if (snapshot.status === "failed") {
      summary.providerErrors += 1;
      logger.warn("Falha ao consultar assinatura no Asaas durante reconciliação", {
        subscriptionId: row.id,
        error: snapshot.errorMessage,
      });
      continue;
    }

    const isGoneOrExpired =
      snapshot.status === "not_found" || snapshot.data?.deleted || snapshot.data?.status === "EXPIRED";

    if (isGoneOrExpired) {
      const newStatus = snapshot.data?.status === "EXPIRED" ? "expired" : "canceled";
      await admin
        .from("organization_subscriptions")
        .update({
          status: newStatus,
          canceled_at: newStatus === "canceled" ? new Date().toISOString() : null,
        })
        .eq("id", row.id);
      await restrictAiEntitlement(admin, row.organization_id);
      await admin.from("audit_logs").insert({
        organization_id: row.organization_id,
        actor_id: null,
        action: "billing.reconcile.subscription_gone",
        resource_type: "organization_subscription",
        resource_id: row.id,
        metadata: { new_status: newStatus },
      });
      summary.canceledOrExpired += 1;
    }
  }

  return summary;
}
