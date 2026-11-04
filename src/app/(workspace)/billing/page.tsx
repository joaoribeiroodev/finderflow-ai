import type { Metadata } from "next";

import { isAsaasConfigured, getServerEnv } from "@/lib/env/env.server";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { listActivePlans } from "@/modules/billing/plans.service";
import { getCurrentSubscription, listPaymentHistory } from "@/modules/billing/subscriptions.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PlanPicker } from "@/components/billing/plan-picker";
import { PaymentHistoryTable } from "@/components/billing/payment-history-table";
import { SubscriptionStatusCard } from "@/components/billing/subscription-status-card";

export const metadata: Metadata = { title: "Assinatura — FinderFlow AI" };

export default async function BillingPage() {
  const { organizationId, role } = await requireActiveOrganization();
  const supabase = await createClient();

  const isAdmin = ["owner", "admin"].includes(role);

  const [current, payments, plans, { data: organization }] = await Promise.all([
    getCurrentSubscription(supabase, organizationId),
    listPaymentHistory(supabase, organizationId),
    listActivePlans(supabase),
    supabase
      .from("organizations")
      .select("billing_name, billing_document, billing_email")
      .eq("id", organizationId)
      .single(),
  ]);

  const hasPendingOrActive =
    current && ["incomplete", "trialing", "active", "past_due", "suspended"].includes(current.subscription.status);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Conta e assinatura"
        title="Planos e faturamento"
        subtitle="Checkout recorrente hospedado pelo Asaas. Nenhum valor é aceito do navegador — o backend sempre calcula o preço a partir do plano."
      />

      {!isAsaasConfigured(getServerEnv()) ? (
        <Card>
          <p className="text-sm text-[var(--ff-text-secondary)]">
            O billing (Asaas) ainda não está configurado neste ambiente. Defina{" "}
            <code className="rounded bg-[var(--ff-bg-elevated)] px-1.5 py-0.5 text-xs">ASAAS_API_KEY</code>,{" "}
            <code className="rounded bg-[var(--ff-bg-elevated)] px-1.5 py-0.5 text-xs">ASAAS_API_BASE_URL</code> e{" "}
            <code className="rounded bg-[var(--ff-bg-elevated)] px-1.5 py-0.5 text-xs">ASAAS_WEBHOOK_TOKEN</code>{" "}
            para habilitar assinaturas. Os planos abaixo já refletem o catálogo real cadastrado no banco.
          </p>
        </Card>
      ) : null}

      {current ? <SubscriptionStatusCard subscription={current.subscription} plan={current.plan} /> : null}

      {!isAdmin ? (
        <ErrorState description="Apenas administradores da organização podem gerenciar a assinatura." />
      ) : hasPendingOrActive ? (
        <Card>
          <p className="text-sm text-[var(--ff-text-secondary)]">
            Esta organização já tem uma assinatura em andamento. Para trocar de plano, aguarde a confirmação do
            pagamento atual ou cancele a assinatura em vigor.
          </p>
        </Card>
      ) : (
        <PlanPicker
          plans={plans}
          defaultBillingProfile={{
            name: organization?.billing_name ?? null,
            document: organization?.billing_document ?? null,
            email: organization?.billing_email ?? null,
          }}
        />
      )}

      <PaymentHistoryTable payments={payments} />
    </div>
  );
}
