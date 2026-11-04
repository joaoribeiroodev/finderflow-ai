"use client";

import { useActionState, useState } from "react";
import { CreditCard } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { startCheckoutAction, type CheckoutActionResult } from "@/modules/billing/actions";
import type { Database } from "@/types/database";

type PlanRow = Database["public"]["Tables"]["plans"]["Row"];

const initialState: CheckoutActionResult = { success: false };

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}

/**
 * Seletor de plano + formulário de dados de faturamento. O preço exibido
 * vem sempre do registro de `plans` já carregado pelo servidor — o
 * usuário nunca pode alterar o valor cobrado (o backend recalcula tudo
 * em `startCheckout`, mesmo que o form fosse adulterado).
 */
export function PlanPicker({
  plans,
  defaultBillingProfile,
}: {
  plans: PlanRow[];
  defaultBillingProfile: { name: string | null; document: string | null; email: string | null };
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(plans[0]?.id ?? null);
  const [state, formAction, isPending] = useActionState(startCheckoutAction, initialState);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CreditCard className="size-4 text-[var(--ff-violet-glow)]" aria-hidden /> Assinar um plano
          </span>
        }
        subtitle="Checkout hospedado pelo Asaas (Sandbox). O pagamento só é confirmado quando o Asaas notifica o FinderFlow — o retorno do checkout é apenas informativo."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {plans.map((plan) => {
          const limits = plan.limits as Record<string, unknown> | null;
          const aiLimit = limits && typeof limits.ai_monthly_requests === "number" ? limits.ai_monthly_requests : null;
          const selected = selectedPlanId === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              className={`flex flex-col gap-1 rounded-[var(--ff-radius-md)] border p-4 text-left transition-colors ${
                selected
                  ? "border-[var(--ff-purple-500)] bg-[var(--ff-bg-elevated)]"
                  : "border-[var(--ff-border-subtle)] hover:border-[var(--ff-purple-500)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--ff-text-primary)]">{plan.name}</span>
                {selected ? <Badge variant="default">Selecionado</Badge> : null}
              </div>
              <span className="text-lg font-bold text-[var(--ff-text-primary)]">
                {formatPrice(Number(plan.price))}
                <span className="text-xs font-normal text-[var(--ff-text-muted)]">/mês</span>
              </span>
              {plan.description ? (
                <p className="text-xs text-[var(--ff-text-secondary)]">{plan.description}</p>
              ) : null}
              {aiLimit !== null ? (
                <p className="text-xs text-[var(--ff-text-muted)]">{aiLimit} chamadas de IA/mês</p>
              ) : null}
            </button>
          );
        })}
      </div>

      <form action={formAction} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="planId" value={selectedPlanId ?? ""} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Razão social / nome completo"
            name="billingName"
            required
            defaultValue={defaultBillingProfile.name ?? undefined}
            errors={state.fieldErrors?.billingName}
          />
          <Field
            label="CPF ou CNPJ"
            name="billingDocument"
            required
            placeholder="Apenas números ou com máscara"
            defaultValue={defaultBillingProfile.document ?? undefined}
            errors={state.fieldErrors?.billingDocument}
          />
          <Field
            label="E-mail de faturamento"
            name="billingEmail"
            type="email"
            required
            defaultValue={defaultBillingProfile.email ?? undefined}
            errors={state.fieldErrors?.billingEmail}
          />
        </div>

        {state.notConfigured ? (
          <p className="text-sm text-[var(--ff-text-secondary)]">
            O billing (Asaas) ainda não está configurado neste ambiente. Configure
            <code className="mx-1 rounded bg-[var(--ff-bg-elevated)] px-1.5 py-0.5 text-xs">ASAAS_API_KEY</code>,
            <code className="mx-1 rounded bg-[var(--ff-bg-elevated)] px-1.5 py-0.5 text-xs">ASAAS_API_BASE_URL</code>
            e
            <code className="mx-1 rounded bg-[var(--ff-bg-elevated)] px-1.5 py-0.5 text-xs">ASAAS_WEBHOOK_TOKEN</code>
            para habilitar assinaturas.
          </p>
        ) : null}

        {!state.notConfigured && state.message ? (
          <p role="alert" className="text-sm text-[var(--ff-danger)]">
            {state.message}
          </p>
        ) : null}

        <Button type="submit" disabled={isPending || !selectedPlanId} className="w-fit">
          {isPending ? "Redirecionando para o checkout..." : "Ir para o checkout"}
        </Button>
      </form>
    </Card>
  );
}
