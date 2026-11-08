"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import {
  clearAsaasCredentialsAction,
  clearGmailCredentialsAction,
  clearOpenAiCredentialsAction,
  clearPageSpeedCredentialsAction,
  saveAsaasCredentialsAction,
  saveGmailCredentialsAction,
  saveOpenAiCredentialsAction,
  savePageSpeedCredentialsAction,
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
    <div className="flex flex-col gap-3 border-b border-[var(--ff-border-subtle)] py-5">
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

export function PageSpeedCredentialsForm({ configured }: { configured: boolean }) {
  const [state, formAction, isPending] = useActionState(savePageSpeedCredentialsAction, initialState);

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--ff-border-subtle)] py-5">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-[var(--ff-text-primary)]">Google PageSpeed Insights</p>
        {configured ? <Badge variant="success">Configurada</Badge> : <Badge variant="outline">Não configurada</Badge>}
      </div>
      <p className="text-xs text-[var(--ff-text-muted)]">
        Usada na Auditoria de Site (desempenho, acessibilidade, boas práticas e SEO) na página da
        empresa — API gratuita do Google (cota de 25.000 consultas/dia), sem precisar habilitar
        faturamento. Crie uma chave em{" "}
        <a
          href="https://developers.google.com/speed/docs/insights/v5/get-started"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--ff-violet-glow)] hover:underline"
        >
          um projeto Google Cloud
        </a>{" "}
        (ative a &quot;PageSpeed Insights API&quot; e gere uma chave de API).
      </p>
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field
            label="Chave de API da PageSpeed Insights"
            name="apiKey"
            type="password"
            placeholder={configured ? "•••••••••••• (substituir)" : "AIza..."}
            autoComplete="off"
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
        <form action={clearPageSpeedCredentialsAction}>
          <Button type="submit" size="sm" variant="ghost">
            Remover chave da PageSpeed
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function GmailCredentialsForm({
  configured,
  email,
}: {
  configured: boolean;
  email: string | null;
}) {
  const [state, formAction, isPending] = useActionState(saveGmailCredentialsAction, initialState);

  return (
    <div className="flex flex-col gap-3 pt-5">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-[var(--ff-text-primary)]">Gmail (e-mails de prospecção)</p>
        {configured ? (
          <Badge variant="success">Conectado{email ? ` (${email})` : ""}</Badge>
        ) : (
          <Badge variant="outline">Não conectado</Badge>
        )}
      </div>
      <p className="text-xs text-[var(--ff-text-muted)]">
        Usada na aba Propostas e na tela do lead para enviar e-mails de prospecção gerados pela
        IA — os e-mails saem da sua própria conta Gmail (mais credibilidade, menos chance de cair
        em spam). Use uma{" "}
        <a
          href="https://myaccount.google.com/apppasswords"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--ff-violet-glow)] hover:underline"
        >
          senha de app
        </a>{" "}
        — não a senha normal da sua conta Google (exige verificação em duas etapas ativada).
      </p>
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field
            label="E-mail Gmail"
            name="email"
            type="email"
            placeholder="voce@gmail.com"
            defaultValue={email ?? ""}
            autoComplete="off"
          />
        </div>
        <div className="flex-1">
          <Field
            label="Senha de app"
            name="appPassword"
            type="password"
            placeholder={configured ? "•••••••••••• (substituir)" : "xxxx xxxx xxxx xxxx"}
            autoComplete="off"
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
        <form action={clearGmailCredentialsAction}>
          <Button type="submit" size="sm" variant="ghost">
            Desconectar conta Gmail
          </Button>
        </form>
      ) : null}
    </div>
  );
}
