"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { createCompanyAction, type CompanyActionResult } from "@/modules/companies/actions";

const initialState: CompanyActionResult = { success: false };

export function CompanyForm() {
  const [state, formAction, isPending] = useActionState(createCompanyAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Nome da empresa"
          name="name"
          required
          defaultValue={state.values?.name}
          errors={state.fieldErrors?.name}
        />
        <Field
          label="CNPJ (opcional)"
          name="cnpj"
          placeholder="00.000.000/0000-00"
          defaultValue={state.values?.cnpj}
          errors={state.fieldErrors?.cnpj}
        />
        <Field
          label="Categoria/segmento"
          name="category"
          placeholder="Ex.: Restaurante"
          defaultValue={state.values?.category}
          errors={state.fieldErrors?.category}
        />
        <Field
          label="Site"
          name="website"
          placeholder="empresa.com.br"
          defaultValue={state.values?.website}
          errors={state.fieldErrors?.website}
        />
        <Field label="Telefone" name="phone" defaultValue={state.values?.phone} errors={state.fieldErrors?.phone} />
        <Field
          label="E-mail"
          name="email"
          type="email"
          defaultValue={state.values?.email}
          errors={state.fieldErrors?.email}
        />
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium text-[var(--ff-text-secondary)]">Endereço (opcional)</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Logradouro" name="street" defaultValue={state.values?.street} errors={state.fieldErrors?.street} />
          <Field label="Cidade" name="city" defaultValue={state.values?.city} errors={state.fieldErrors?.city} />
          <Field
            label="UF"
            name="state"
            maxLength={2}
            placeholder="BA"
            defaultValue={state.values?.state}
            errors={state.fieldErrors?.state}
          />
          <Field label="CEP" name="zipCode" defaultValue={state.values?.zipCode} errors={state.fieldErrors?.zipCode} />
        </div>
      </fieldset>

      {state.duplicateWarning ? (
        <div
          role="alert"
          className="rounded-xl border border-[#6b531d] bg-[#3c3016] px-4 py-3 text-sm text-[#f9d57b]"
        >
          <p>{state.duplicateWarning.message}</p>
          <label className="mt-2 flex items-center gap-2 text-[var(--ff-text-primary)]">
            <input type="checkbox" name="confirmDuplicate" value="true" className="size-4" />
            Cadastrar mesmo assim (é uma empresa diferente)
          </label>
        </div>
      ) : state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Cadastrar empresa"}
        </Button>
        <Link href="/companies" className="text-sm text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
