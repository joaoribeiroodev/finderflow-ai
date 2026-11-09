"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { refreshChargeStatusAction } from "@/modules/contracts/actions";
import type { ContractChargeView } from "@/modules/contracts/contracts.service";
import { formatCalendarDate } from "@/lib/utils/format";

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "outline"> = {
  PENDING: "warning",
  RECEIVED: "success",
  CONFIRMED: "success",
  RECEIVED_IN_CASH: "success",
  OVERDUE: "danger",
  REFUNDED: "outline",
  DELETED: "outline",
};

const BILLING_LABEL: Record<string, string> = {
  BOLETO: "Boleto",
  PIX: "Pix",
  UNDEFINED: "Link",
};

function ChargeRow({ charge }: { charge: ContractChargeView }) {
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex flex-col gap-2 border-b border-[var(--ff-border-subtle)] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <p className="font-medium text-[var(--ff-text-primary)]">
            {charge.companyName ?? "Empresa removida"}
          </p>
          <Badge variant={STATUS_VARIANT[charge.status] ?? "outline"}>{charge.status}</Badge>
          <Badge variant="outline">{BILLING_LABEL[charge.billingType] ?? charge.billingType}</Badge>
        </div>
        <p className="text-xs text-[var(--ff-text-muted)]">
          R$ {charge.value.toFixed(2)}
          {charge.dueDate ? ` · vence em ${formatCalendarDate(charge.dueDate)}` : ""}
          {charge.description ? ` · ${charge.description}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {charge.invoiceUrl ? (
          <a
            href={charge.invoiceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--ff-violet-glow)] hover:underline"
          >
            Ver na Asaas
          </a>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => startTransition(() => refreshChargeStatusAction(charge.id))}
        >
          <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} aria-hidden />
        </Button>
      </div>
    </li>
  );
}

export function ChargesHistory({ charges }: { charges: ContractChargeView[] }) {
  if (charges.length === 0) {
    return <p className="text-sm text-[var(--ff-text-muted)]">Nenhuma cobrança criada ainda.</p>;
  }

  return (
    <ul>
      {charges.map((charge) => (
        <ChargeRow key={charge.id} charge={charge} />
      ))}
    </ul>
  );
}
