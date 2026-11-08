"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { removeCadenceStepAction, type CadenceActionResult } from "@/modules/cadences/cadences.actions";
import type { CadenceStepRow } from "@/modules/cadences/cadences.service";

const initialState: CadenceActionResult = { success: false };

function RemoveStepButton({ cadenceId, stepId }: { cadenceId: string; stepId: string }) {
  const [, formAction, isPending] = useActionState(removeCadenceStepAction, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="cadenceId" value={cadenceId} />
      <input type="hidden" name="stepId" value={stepId} />
      <Button type="submit" size="sm" variant="ghost" disabled={isPending} aria-label="Remover etapa">
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </form>
  );
}

export function CadenceStepList({ cadenceId, steps }: { cadenceId: string; steps: CadenceStepRow[] }) {
  if (steps.length === 0) {
    return <p className="text-sm text-[var(--ff-text-secondary)]">Nenhuma etapa configurada ainda.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step) => (
        <li key={step.id} className="rounded-xl border border-[var(--ff-border-subtle)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--ff-text-primary)]">
                Etapa {step.stepOrder} — dia {step.dayOffset}
              </p>
              <p className="mt-1 text-sm text-[var(--ff-text-secondary)]">{step.subjectTemplate}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--ff-text-muted)]">{step.bodyTemplate}</p>
            </div>
            <RemoveStepButton cadenceId={cadenceId} stepId={step.id} />
          </div>
        </li>
      ))}
    </ol>
  );
}
