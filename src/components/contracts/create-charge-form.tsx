"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { createChargeAction, type ContractActionResult } from "@/modules/contracts/actions";
import type { CompanyOption } from "@/modules/contracts/contracts.service";

const initialState: ContractActionResult = { success: false };

export function CreateChargeForm({ companies }: { companies: CompanyOption[] }) {
  const [state, formAction, isPending] = useActionState(createChargeAction, initialState);

  if (companies.length === 0) {
    return (
      <p className="text-sm text-[var(--ff-text-muted)]">
        Nenhuma empresa cadastrada ainda. Cadastre uma empresa com CNPJ válido para poder criar
        cobranças para ela.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField label="Empresa (cliente)" name="companyId" required defaultValue="">
          <option value="" disabled>
            Selecione...
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id} disabled={!c.cnpj}>
              {c.name}
              {!c.cnpj ? " (sem CNPJ cadastrado)" : ""}
            </option>
          ))}
        </SelectField>
        <SelectField label="Forma de cobrança" name="billingType" required defaultValue="BOLETO">
          <option value="BOLETO">Boleto</option>
          <option value="PIX">Pix</option>
          <option value="UNDEFINED">Link (cliente escolhe)</option>
        </SelectField>
        <Field label="Valor (R$)" name="value" type="number" min="0.01" step="0.01" required />
        <Field label="Vencimento" name="dueDate" type="date" required />
      </div>
      <Field label="Descrição (opcional)" name="description" placeholder="Ex.: Mensalidade de novembro" />
      {state.message ? (
        <p
          role="alert"
          className={`text-sm ${state.success ? "text-[var(--ff-success)]" : "text-[var(--ff-danger)]"}`}
        >
          {state.message}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Criando cobrança..." : "Criar cobrança"}
        </Button>
      </div>
    </form>
  );
}
