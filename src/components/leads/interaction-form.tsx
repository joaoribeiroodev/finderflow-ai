"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { INTERACTION_TYPE_LABELS, INTERACTION_TYPES } from "@/lib/validation/interactions";
import { createInteractionAction, type SimpleActionResult } from "@/modules/leads/crm-items.actions";

const initialState: SimpleActionResult = { success: false };

export function InteractionForm({ leadId }: { leadId: string }) {
  const [state, formAction, isPending] = useActionState(createInteractionAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <SelectField label="Tipo" name="type" defaultValue="call" errors={state.fieldErrors?.type}>
        {INTERACTION_TYPES.map((type) => (
          <option key={type} value={type}>
            {INTERACTION_TYPE_LABELS[type]}
          </option>
        ))}
      </SelectField>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="contentSummary" className="text-sm font-medium text-[var(--ff-text-secondary)]">
          Resumo
        </label>
        <textarea
          id="contentSummary"
          name="contentSummary"
          rows={3}
          placeholder="O que foi conversado, próximos passos..."
          className="rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 py-2.5 text-sm text-[var(--ff-text-primary)] outline-none placeholder:text-[var(--ff-text-muted)] focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
        />
        {state.fieldErrors?.contentSummary ? (
          <p role="alert" className="text-sm text-[var(--ff-danger)]">
            {state.fieldErrors.contentSummary[0]}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Registrando..." : "Registrar interação"}
      </Button>
      {state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
