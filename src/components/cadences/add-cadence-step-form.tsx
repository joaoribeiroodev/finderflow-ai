"use client";

import { useActionState } from "react";

import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { addCadenceStepAction, type CadenceActionResult } from "@/modules/cadences/cadences.actions";

const initialState: CadenceActionResult = { success: false };

/**
 * Formulário de template da etapa — escrito por um humano (nunca
 * gerado por IA, ver cadence-compose.ts). Placeholders disponíveis:
 * {{contact_name}}, {{company_name}}, {{sender_name}}.
 */
export function AddCadenceStepForm({ cadenceId, nextStepOrder }: { cadenceId: string; nextStepOrder: number }) {
  const [state, formAction, isPending] = useActionState(addCadenceStepAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-[var(--ff-border-subtle)] p-4">
      <input type="hidden" name="cadenceId" value={cadenceId} />
      <div className="flex gap-3">
        <div className="w-28">
          <Field label="Ordem" name="stepOrder" type="number" min={1} defaultValue={nextStepOrder} required />
        </div>
        <div className="w-40">
          <Field label="Enviar no dia" name="dayOffset" type="number" min={0} defaultValue={0} required />
        </div>
      </div>
      <Field label="Assunto do e-mail" name="subjectTemplate" placeholder="Ex.: Oi {{contact_name}}, ainda por aí?" required />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`bodyTemplate-${cadenceId}-${nextStepOrder}`} className="text-sm font-medium text-[var(--ff-text-secondary)]">
          Corpo do e-mail
        </label>
        <textarea
          id={`bodyTemplate-${cadenceId}-${nextStepOrder}`}
          name="bodyTemplate"
          rows={4}
          placeholder="Use {{contact_name}}, {{company_name}} e {{sender_name}} para personalizar automaticamente."
          className="rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 py-2.5 text-sm text-[var(--ff-text-primary)] outline-none placeholder:text-[var(--ff-text-muted)] focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
          required
        />
      </div>

      {state.message ? (
        <p role="alert" className={`text-sm ${state.success ? "text-[var(--ff-success)]" : "text-[var(--ff-danger)]"}`}>
          {state.message}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
          {isPending ? "Adicionando..." : "Adicionar etapa"}
        </Button>
      </div>
    </form>
  );
}
