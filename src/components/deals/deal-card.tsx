"use client";

import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatRelativeDateTime } from "@/lib/utils/format";
import { DEAL_STATUS_LABELS, type DealStatus } from "@/lib/validation/deals";
import { closeDealAction, createDealFromProposalAction, type DealActionResult } from "@/modules/deals/actions";
import type { DealRow } from "@/modules/deals/deals.service";

const STATUS_VARIANT: Record<DealStatus, "default" | "success" | "danger"> = {
  open: "default",
  won: "success",
  lost: "danger",
};

const initialState: DealActionResult = { success: false };

function CloseDealForm({ deal, proposalId }: { deal: DealRow; proposalId: string }) {
  const [state, formAction, isPending] = useActionState(closeDealAction, initialState);
  const [status, setStatus] = useState<"won" | "lost">("won");

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
      <input type="hidden" name="dealId" value={deal.id} />
      <input type="hidden" name="proposalId" value={proposalId} />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={status === "won" ? "primary" : "secondary"}
          onClick={() => setStatus("won")}
        >
          Ganho
        </Button>
        <Button
          type="button"
          size="sm"
          variant={status === "lost" ? "primary" : "secondary"}
          onClick={() => setStatus("lost")}
        >
          Perdido
        </Button>
      </div>
      <input type="hidden" name="status" value={status} />
      {status === "lost" ? (
        <div className="min-w-[220px] flex-1">
          <label className="text-sm font-medium text-[var(--ff-text-secondary)]" htmlFor="lostReason">
            Motivo da perda
          </label>
          <input
            id="lostReason"
            name="lostReason"
            className="mt-1.5 h-11 w-full rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 text-sm text-[var(--ff-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
            placeholder="Ex.: optou pelo concorrente, preço, sem orçamento..."
          />
        </div>
      ) : null}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Registrando..." : "Confirmar"}
      </Button>
      {state.fieldErrors?.lostReason ? (
        <p role="alert" className="w-full text-sm text-[var(--ff-danger)]">
          {state.fieldErrors.lostReason[0]}
        </p>
      ) : null}
      {state.message ? (
        <p role="alert" className="w-full text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function DealCard({ deal, proposalId }: { deal: DealRow | null; proposalId: string }) {
  if (!deal) {
    return (
      <form action={createDealFromProposalAction}>
        <input type="hidden" name="proposalId" value={proposalId} />
        <Button type="submit" variant="secondary" size="sm">
          Converter em negócio
        </Button>
      </form>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--ff-border-subtle)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-[var(--ff-text-primary)]">{deal.title}</p>
          <p className="text-xs text-[var(--ff-text-muted)]">
            {formatBRL(Number(deal.amount))} · aberto {formatRelativeDateTime(deal.created_at)}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[deal.status as DealStatus]}>{DEAL_STATUS_LABELS[deal.status as DealStatus]}</Badge>
      </div>
      {deal.status === "lost" && deal.lost_reason ? (
        <p className="mt-2 text-xs text-[var(--ff-text-secondary)]">Motivo: {deal.lost_reason}</p>
      ) : null}
      {deal.status === "open" ? <CloseDealForm deal={deal} proposalId={proposalId} /> : null}
    </div>
  );
}
