"use client";

import { useActionState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { addProposalItemAction, type ProposalActionResult } from "@/modules/proposals/actions";
import type { ServiceRow } from "@/modules/services/services.service";

const initialState: ProposalActionResult = { success: false };

export function ProposalItemForm({ proposalId, services }: { proposalId: string; services: ServiceRow[] }) {
  const [state, formAction, isPending] = useActionState(addProposalItemAction, initialState);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const unitPriceRef = useRef<HTMLInputElement>(null);

  function handleServiceChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const service = services.find((s) => s.id === event.target.value);
    if (!service) return;
    if (descriptionRef.current && !descriptionRef.current.value) {
      descriptionRef.current.value = service.name;
    }
    if (unitPriceRef.current && service.base_price !== null) {
      unitPriceRef.current.value = String(service.base_price);
    }
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-[var(--ff-border-subtle)] p-3">
      <input type="hidden" name="proposalId" value={proposalId} />
      <div className="min-w-[160px]">
        <SelectField
          label="Serviço (opcional)"
          name="serviceId"
          defaultValue=""
          errors={state.fieldErrors?.serviceId}
          onChange={handleServiceChange}
        >
          <option value="">Item livre</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="min-w-[200px] flex-1">
        <Field ref={descriptionRef} label="Descrição" name="description" errors={state.fieldErrors?.description} />
      </div>
      <div className="w-24">
        <Field label="Qtd." name="quantity" inputMode="decimal" defaultValue="1" errors={state.fieldErrors?.quantity} />
      </div>
      <div className="w-32">
        <Field
          ref={unitPriceRef}
          label="Preço unit. (R$)"
          name="unitPrice"
          inputMode="decimal"
          errors={state.fieldErrors?.unitPrice}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Adicionando..." : "Adicionar item"}
      </Button>
      {state.message ? (
        <p role="alert" className="w-full text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
