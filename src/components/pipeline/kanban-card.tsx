"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";

import { PriorityBadge } from "@/components/leads/priority-badge";
import { moveLeadStageAction, type LeadActionResult } from "@/modules/leads/actions";
import { formatBRL } from "@/lib/utils/format";
import type { LeadListItem } from "@/modules/leads/leads.service";

const initialState: LeadActionResult = { success: false };

export interface KanbanStageOption {
  id: string;
  name: string;
}

/**
 * Card do Kanban com um `<select>` para mover de etapa (dispara o
 * formulário automaticamente no `onChange`). Escolhido no lugar de
 * arrastar-e-soltar: é acessível por teclado por padrão, não precisa de
 * biblioteca extra, e funciona exatamente igual em qualquer navegador —
 * trade-off registrado em docs/DECISIONS.md.
 */
export function KanbanCard({ lead, stages }: { lead: LeadListItem; stages: KanbanStageOption[] }) {
  const [state, formAction] = useActionState(moveLeadStageAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] p-3">
      <Link
        href={`/leads/${lead.id}`}
        className="font-medium text-[var(--ff-text-primary)] hover:text-[var(--ff-violet-glow)]"
      >
        {lead.company?.name ?? "—"}
      </Link>
      <div className="flex items-center justify-between gap-2">
        <PriorityBadge priority={lead.priority} />
        {lead.estimated_value != null ? (
          <span className="text-xs text-[var(--ff-text-muted)]">{formatBRL(lead.estimated_value)}</span>
        ) : null}
      </div>
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="leadId" value={lead.id} />
        <label className="sr-only" htmlFor={`move-${lead.id}`}>
          Mover {lead.company?.name} para outra etapa
        </label>
        <select
          id={`move-${lead.id}`}
          name="stageId"
          defaultValue={lead.stage_id}
          onChange={() => formRef.current?.requestSubmit()}
          className="h-9 w-full rounded-lg border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-elevated)] px-2 text-xs text-[var(--ff-text-secondary)] outline-none focus-visible:border-[var(--ff-purple-500)]"
        >
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </form>
      {state.message ? (
        <p role="alert" className="text-xs text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
