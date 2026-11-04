"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { createTaskAction, type SimpleActionResult } from "@/modules/leads/crm-items.actions";

const initialState: SimpleActionResult = { success: false };

export function TaskForm({ leadId }: { leadId: string }) {
  const [state, formAction, isPending] = useActionState(createTaskAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <Field label="Título" name="title" required errors={state.fieldErrors?.title} />
      <Field label="Descrição (opcional)" name="description" errors={state.fieldErrors?.description} />
      <Field label="Prazo (opcional)" name="dueAt" type="datetime-local" errors={state.fieldErrors?.dueAt} />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Criando..." : "Criar tarefa"}
      </Button>
      {state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
