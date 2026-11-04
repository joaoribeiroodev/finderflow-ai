import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { Database } from "@/types/database";

type SubscriptionRow = Database["public"]["Tables"]["organization_subscriptions"]["Row"];
type PlanRow = Database["public"]["Tables"]["plans"]["Row"];

const STATUS_LABEL: Record<SubscriptionRow["status"], string> = {
  incomplete: "Aguardando confirmação de pagamento",
  trialing: "Em período de teste",
  active: "Ativa",
  past_due: "Pagamento atrasado (tolerância)",
  suspended: "Suspensa por inadimplência",
  canceled: "Cancelada",
  expired: "Expirada",
};

const STATUS_VARIANT: Record<SubscriptionRow["status"], BadgeProps["variant"]> = {
  incomplete: "outline",
  trialing: "default",
  active: "success",
  past_due: "warning",
  suspended: "danger",
  canceled: "outline",
  expired: "outline",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export function SubscriptionStatusCard({
  subscription,
  plan,
}: {
  subscription: SubscriptionRow;
  plan: PlanRow | null;
}) {
  return (
    <Card>
      <CardHeader
        title="Assinatura atual"
        subtitle="Estado sincronizado via webhook do Asaas — nunca a partir do retorno do checkout."
      />
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-[var(--ff-text-muted)]">Plano</dt>
          <dd className="mt-1 text-sm text-[var(--ff-text-primary)]">{plan?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--ff-text-muted)]">Status</dt>
          <dd className="mt-1">
            <Badge variant={STATUS_VARIANT[subscription.status]}>{STATUS_LABEL[subscription.status]}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--ff-text-muted)]">Próximo vencimento</dt>
          <dd className="mt-1 text-sm text-[var(--ff-text-primary)]">{formatDate(subscription.next_due_date)}</dd>
        </div>
      </dl>
      {subscription.status === "past_due" ? (
        <p className="mt-4 text-xs text-[var(--ff-warning)]">
          Pagamento em atraso. Os recursos pagos continuam ativos durante o período de tolerância comercial;
          após esse prazo, recursos de IA são restringidos sem apagar nenhum dado.
        </p>
      ) : null}
      {subscription.status === "suspended" ? (
        <p className="mt-4 text-xs text-[var(--ff-danger)]">
          Recursos de IA restringidos por inadimplência. Nenhum dado foi apagado — regularize o pagamento para
          reativar.
        </p>
      ) : null}
    </Card>
  );
}
