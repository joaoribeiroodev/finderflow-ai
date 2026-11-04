"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { registerAction, type ActionResult } from "@/modules/auth/actions";

const initialState: ActionResult = { success: false };

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  if (state.success) {
    return <p className="text-center text-sm text-[var(--ff-success)]">{state.message}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Nome completo"
        name="fullName"
        autoComplete="name"
        required
        errors={state.fieldErrors?.fullName}
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={state.fieldErrors?.email}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.password}
      />
      <Field
        label="Confirmar senha"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      {state.message && (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Criando conta..." : "Criar conta"}
      </Button>
    </form>
  );
}
