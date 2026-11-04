"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { createProposalAction, type ProposalActionResult } from "@/modules/proposals/actions";

const initialState: ProposalActionResult = { success: false };

export function ProposalCreateForm({
  leads,
  defaultLeadId,
}: {
  leads: { id: string; companyName: string }[];
  defaultLeadId?: string;
}) {
  const [state, formAction, isPending] = useActionState(createProposalAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1">
        <SelectField
          label="Lead"
          name="leadId"
          defaultValue={defaultLeadId ?? ""}
          errors={state.fieldErrors?.leadId}
          disabled={leads.length === 0}
        >
          <option value="" disabled>
            Selecione um lead
          </option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.companyName}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="min-w-[180px]">
        <Field label="Válida até (opcional)" name="validUntil" type="date" errors={state.fieldErrors?.validUntil} />
      </div>
      <Button type="submit" disabled={isPending || leads.length === 0}>
        {isPending ? "Criando..." : "Nova proposta"}
      </Button>
      {leads.length === 0 ? (
        <p className="w-full text-xs text-[var(--ff-text-muted)]">
          Cadastre uma empresa e converta-a em lead antes de criar uma proposta.
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
