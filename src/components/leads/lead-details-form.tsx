"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { updateLeadDetailsAction, type LeadActionResult } from "@/modules/leads/actions";

const initialState: LeadActionResult = { success: false };

/** Converte um ISO (UTC) para o valor esperado por <input type="datetime-local">, no horário local. */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function LeadDetailsForm({
  leadId,
  priority,
  estimatedValue,
  probability,
  serviceInterest,
  nextContactAt,
}: {
  leadId: string;
  priority: string;
  estimatedValue: number | null;
  probability: number | null;
  serviceInterest: string | null;
  nextContactAt: string | null;
}) {
  const [state, formAction, isPending] = useActionState(updateLeadDetailsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="leadId" value={leadId} />

      <SelectField label="Prioridade" name="priority" defaultValue={priority} errors={state.fieldErrors?.priority}>
        <option value="low">Baixa</option>
        <option value="medium">Média</option>
        <option value="high">Alta</option>
      </SelectField>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Valor estimado (R$)"
          name="estimatedValue"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={estimatedValue ?? ""}
          errors={state.fieldErrors?.estimatedValue}
        />
        <Field
          label="Probabilidade (%)"
          name="probability"
          inputMode="numeric"
          placeholder="0-100"
          defaultValue={probability ?? ""}
          errors={state.fieldErrors?.probability}
        />
      </div>

      <Field
        label="Interesse em serviço"
        name="serviceInterest"
        placeholder="Ex.: Site institucional"
        defaultValue={serviceInterest ?? ""}
        errors={state.fieldErrors?.serviceInterest}
      />

      <Field
        label="Próximo contato"
        name="nextContactAt"
        type="datetime-local"
        defaultValue={toDatetimeLocalValue(nextContactAt)}
        errors={state.fieldErrors?.nextContactAt}
      />

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Salvando..." : "Salvar"}
      </Button>

      {state.success ? <p className="text-sm text-[var(--ff-success)]">Atualizado.</p> : null}
      {state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
