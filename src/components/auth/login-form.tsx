"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { loginAction, type ActionResult } from "@/modules/auth/actions";

const initialState: ActionResult = { success: false };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="E-mail" name="email" type="email" autoComplete="email" required />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {state.message && (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      )}
      <div className="flex justify-end">
        <Link href="/recovery" className="text-sm text-[var(--ff-violet-glow)] hover:underline">
          Esqueceu sua senha?
        </Link>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
