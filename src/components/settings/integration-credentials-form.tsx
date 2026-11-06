"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import {
  clearAsaasCredentialsAction,
  clearOpenAiCredentialsAction,
  saveAsaasCredentialsAction,
  saveOpenAiCredentialsAction,
  type CredentialsActionResult,
} from "@/modules/organizations/credentials.actions";

const initialState: CredentialsActionResult = { success: false };

export function AsaasCredentialsForm({
  configured,
  environment,
}: {
  configured: boolean;
  environment: "sandbox" | "production";
}) {
  const [state, formAction, isPending] = useActionState(saveAsaasCredentialsAction, initialState);

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--ff-border-subtle)] pb-5">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-[var(--ff-text-primary)]">Asaas</p>
        {configured ? (
          <Badge variant="success">Configurada ({environment === "production" ? "produção" : "sandbox"})</Badge>
        ) : (
          <Badge variant="outline">Não configurada</Badge>
        )}
      </div>
      <p className="text-xs text-[var(--ff-text-muted)]">
        Usada na aba Contratos para gerar cobranças, boletos e links de pagamento para os
        clientes desta organização — com a conta Asaas da própria organização, não do FinderFlow.
      </p>
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field
            label="Chave de API da Asaas"
            name="apiKey"
            type="password"
            placeholder={configured ? "•••••••••••• (substituir)" : "$aact_..."}
            autoComplete="off"
          />
        </div>
        <div className="sm:w-40">
          <label className="mb-1.5 block text-sm font-medium text-[var(--ff-text-primary)]">
            Ambiente
          </label>
          <select
            name="environment"
            defaultValue={environment}
            className="h-11 w-full rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-elevated)] px-3 text-sm text-[var(--ff-text-primary)]"
          >
            <option value="sandbox">Sandbox</option>
            <option value="production">Produção</option>
          </select>
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </form>
      {state.message ? (
        <p role="alert" className={`text-xs ${state.success ? "text-[var(--ff-success)]" : "text-[var(--ff-danger)]"}`}>
          {state.message}
        </p>
      ) : null}
      {configured ? (
        <form action={clearAsaasCredentialsAction}>
          <Button type="submit" size="sm" variant="ghost">
            Remover chave da Asaas
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function OpenAiCredentialsForm({
  configured,
  model,
}: {
  configured: boolean;
  model: string | null;
}) {
  const [state, formAction, isPending] = useActionState(saveOpenAiCredentialsAction, initialState);

  return (
    <div className="flex flex-col gap-3 pt-5">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-[var(--ff-text-primary)]">OpenAI</p>
        {configured ? (
          <Badge variant="success">Configurada{model ? ` (${model})` : ""}</Badge>
        ) : (
          <Badge variant="outline">Não configurada</Badge>
        )}
      </div>
      <p className="text-xs text-[var(--ff-text-muted)]">
        Usada pelo Assistente de IA e pelas análises de empresas/leads — o uso é cobrado
        diretamente na sua própria conta OpenAI, sem limite imposto pelo FinderFlow.
      </p>
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field
            label="Chave de API da OpenAI"
            name="apiKey"
            type="password"
            placeholder={configured ? "•••••••••••• (substituir)" : "sk-..."}
            autoComplete="off"
          />
        </div>
        <div className="sm:w-48">
          <Field
            label="Modelo (opcional)"
            name="model"
            placeholder="gpt-4.1-mini"
            defaultValue={model ?? ""}
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </form>
      {state.message ? (
        <p role="alert" className={`text-xs ${state.success ? "text-[var(--ff-success)]" : "text-[var(--ff-danger)]"}`}>
          {state.message}
        </p>
      ) : null}
      {configured ? (
        <form action={clearOpenAiCredentialsAction}>
          <Button type="submit" size="sm" variant="ghost">
            Remover chave da OpenAI
          </Button>
        </form>
      ) : null}
    </div>
  );
}
