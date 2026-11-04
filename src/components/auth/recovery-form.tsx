"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { requestPasswordRecoveryAction, type ActionResult } from "@/modules/auth/actions";

const initialState: ActionResult = { success: false };

export function RecoveryForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordRecoveryAction,
    initialState,
  );

  if (state.success) {
    return <p className="text-center text-sm text-[var(--ff-success)]">{state.message}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={state.fieldErrors?.email}
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Enviando..." : "Enviar link de recuperação"}
      </Button>
    </form>
  );
}
