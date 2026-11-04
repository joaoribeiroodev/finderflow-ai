"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { createContactAction, type SimpleActionResult } from "@/modules/leads/crm-items.actions";

const initialState: SimpleActionResult = { success: false };

export function ContactForm({ leadId, companyId }: { leadId: string; companyId: string }) {
  const [state, formAction, isPending] = useActionState(createContactAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="companyId" value={companyId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" name="name" required errors={state.fieldErrors?.name} />
        <Field label="Cargo" name="position" errors={state.fieldErrors?.position} />
        <Field label="E-mail" name="email" type="email" errors={state.fieldErrors?.email} />
        <Field label="Telefone" name="phone" errors={state.fieldErrors?.phone} />
      </div>
      <Field
        label="Canal preferido"
        name="preferredChannel"
        placeholder="Ex.: WhatsApp"
        errors={state.fieldErrors?.preferredChannel}
      />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Salvando..." : "Adicionar contato"}
      </Button>
      {state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
