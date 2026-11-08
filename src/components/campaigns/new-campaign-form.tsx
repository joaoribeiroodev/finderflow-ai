"use client";

import { useActionState } from "react";

import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createCampaignAction, type CampaignActionResult } from "@/modules/campaigns/campaigns.actions";

const initialState: CampaignActionResult = { success: false };

export function NewCampaignForm() {
  const [state, formAction, isPending] = useActionState(createCampaignAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label="Nome da campanha" name="name" placeholder="Ex.: Padarias sem site — Salvador" required />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="objective" className="text-sm font-medium text-[var(--ff-text-secondary)]">
          Objetivo (contexto para a IA ao escrever os e-mails, opcional)
        </label>
        <textarea
          id="objective"
          name="objective"
          rows={2}
          placeholder="Ex.: Oferecer criação de site para empresas locais sem presença online."
          className="rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 py-2.5 text-sm text-[var(--ff-text-primary)] outline-none placeholder:text-[var(--ff-text-muted)] focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
        />
      </div>

      {state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Criando..." : "Criar campanha"}
        </Button>
      </div>
    </form>
  );
}
