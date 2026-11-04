"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { createStageAction, type StageActionResult } from "@/modules/pipeline/actions";

const initialState: StageActionResult = { success: false };

export function StageCreateForm() {
  const [state, formAction, isPending] = useActionState(createStageAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <Field label="Nova etapa" name="name" placeholder="Ex.: Follow-up" errors={state.fieldErrors?.name} />
      </div>
      <input type="color" name="color" defaultValue="#8B5CF6" className="h-11 w-14 rounded-xl border border-[var(--ff-border-subtle)] bg-transparent" aria-label="Cor da etapa" />
      <div className="min-w-[160px]">
        <SelectField label="Resultado" name="resultType" defaultValue="">
          <option value="">Aberta</option>
          <option value="won">Ganho</option>
          <option value="lost">Perdido</option>
        </SelectField>
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Criando..." : "Adicionar etapa"}
      </Button>
      {state.message ? (
        <p role="alert" className="w-full text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
