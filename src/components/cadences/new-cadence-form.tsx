"use client";

import { useActionState } from "react";

import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createCadenceAction, type CadenceActionResult } from "@/modules/cadences/cadences.actions";

const initialState: CadenceActionResult = { success: false };

export function NewCadenceForm() {
  const [state, formAction, isPending] = useActionState(createCadenceAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label="Nome da cadência" name="name" placeholder="Ex.: Follow-up pós-proposta" required />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-[var(--ff-text-secondary)]">
          Descrição (opcional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          placeholder="Ex.: 3 e-mails de follow-up para leads que receberam proposta e não responderam."
          className="rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 py-2.5 text-sm text-[var(--ff-text-primary)] outline-none placeholder:text-[var(--ff-text-muted)] focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
        />
      </div>

      {state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Criando..." : "Criar cadência"}
        </Button>
      </div>
    </form>
  );
}
