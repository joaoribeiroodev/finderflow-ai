"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { PRICING_TYPE_LABELS, PRICING_TYPES } from "@/lib/validation/services";
import {
  createServiceAction,
  updateServiceAction,
  type ServiceActionResult,
} from "@/modules/services/actions";
import type { ServiceRow } from "@/modules/services/services.service";

const initialState: ServiceActionResult = { success: false };

export function ServiceForm({
  service,
  onDone,
}: {
  service?: ServiceRow;
  onDone?: () => void;
}) {
  const action = service ? updateServiceAction : createServiceAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {service ? <input type="hidden" name="serviceId" value={service.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Nome do serviço"
          name="name"
          defaultValue={service?.name}
          errors={state.fieldErrors?.name}
          required
        />
        <SelectField
          label="Precificação"
          name="pricingType"
          defaultValue={service?.pricing_type ?? "fixed"}
          errors={state.fieldErrors?.pricingType}
        >
          {PRICING_TYPES.map((type) => (
            <option key={type} value={type}>
              {PRICING_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Preço base (R$)"
          name="basePrice"
          inputMode="decimal"
          placeholder="Deixe vazio se for personalizado"
          defaultValue={service?.base_price ?? undefined}
          errors={state.fieldErrors?.basePrice}
        />
        <div className="flex items-center gap-2 pt-7">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            defaultChecked={service?.is_active ?? true}
            className="size-4 rounded border-[var(--ff-border-subtle)]"
          />
          <label htmlFor="isActive" className="text-sm text-[var(--ff-text-secondary)]">
            Ativo (visível para a IA e no construtor de propostas)
          </label>
        </div>
      </div>
      <label htmlFor="description" className="text-sm font-medium text-[var(--ff-text-secondary)]">
        Descrição
      </label>
      <textarea
        id="description"
        name="description"
        defaultValue={service?.description ?? undefined}
        rows={3}
        className="rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 py-2.5 text-sm text-[var(--ff-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
        placeholder="O que está incluído, escopo típico, etc."
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : service ? "Salvar alterações" : "Criar serviço"}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        ) : null}
      </div>
      {state.success ? <p className="text-sm text-[var(--ff-success)]">Salvo.</p> : null}
      {state.message && !state.success ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
