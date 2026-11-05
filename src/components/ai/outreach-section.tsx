"use client";

import { useActionState, useState } from "react";
import { MessageSquareText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { OutreachMessage } from "@/lib/ai/schemas";
import { generateOutreachAction, type AIActionResult } from "@/modules/ai/actions";

const initialState: AIActionResult<OutreachMessage> = { success: false };

const CHANNEL_OPTIONS = [
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone_script", label: "Roteiro de ligação" },
  { value: "linkedin", label: "LinkedIn" },
] as const;

/**
 * Gera um rascunho de abordagem/follow-up. Deixa explícito que é um
 * RASCUNHO para revisão — nada aqui envia a mensagem automaticamente
 * (envio integrado é fase futura, docs/05-integrations.md §5.4).
 */
export function OutreachSection({ leadId }: { leadId: string }) {
  const [state, formAction, isPending] = useActionState(generateOutreachAction, initialState);
  const [channel, setChannel] = useState<string>("email");

  return (
    <Card>
      <CardHeader
        title="Rascunho de abordagem (IA)"
        subtitle="Gere um rascunho para revisar e enviar manualmente — nada é enviado automaticamente."
      />

      <form action={formAction} className="mb-4 flex items-center gap-2">
        <input type="hidden" name="leadId" value={leadId} />
        <label className="sr-only" htmlFor="outreach-channel">
          Canal da abordagem
        </label>
        <select
          id="outreach-channel"
          name="channel"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="h-9 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-elevated)] px-3 text-sm text-[var(--ff-text-primary)]"
        >
          {CHANNEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
          <MessageSquareText className="size-4" aria-hidden />
          {isPending ? "Gerando..." : "Gerar rascunho"}
        </Button>
      </form>

      {state.notConfigured ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">
          A integração com IA ainda não está configurada neste ambiente. Configure a chave da OpenAI para
          habilitar a geração de rascunhos de abordagem.
        </p>
      ) : null}

      {!state.notConfigured && state.message && state.status !== "completed" ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}

      {state.data ? (
        <div className="flex flex-col gap-3 rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{state.data.channel}</Badge>
            <Badge variant="outline">{state.data.tone}</Badge>
          </div>
          {state.data.subject ? (
            <p>
              <span className="text-xs text-[var(--ff-text-muted)] uppercase">Assunto: </span>
              <span className="text-[var(--ff-text-primary)]">{state.data.subject}</span>
            </p>
          ) : null}
          <p className="whitespace-pre-wrap text-[var(--ff-text-primary)]">{state.data.message}</p>
          <p className="text-xs text-[var(--ff-text-secondary)]">
            Sugestão de follow-up: {state.data.follow_up_suggestion}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
