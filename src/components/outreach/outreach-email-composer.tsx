"use client";

import { useActionState, useState, useTransition } from "react";
import { Mail, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import type { OutreachMessage } from "@/lib/ai/schemas";
import { generateOutreachAction, type AIActionResult } from "@/modules/ai/actions";
import { sendOutreachEmailAction, type SendOutreachEmailResult } from "@/modules/outreach-email/actions";
import type { OutreachEmailRow } from "@/modules/outreach-email/outreach-email.service";

const generateInitialState: AIActionResult<OutreachMessage> = { success: false };
const sendInitialState: SendOutreachEmailResult = { success: false };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

/**
 * Compositor de e-mail de prospecção: gera um rascunho com IA a partir
 * do contexto do lead já analisado, deixa editar antes de enviar, e
 * manda de verdade pela conta Gmail conectada da organização
 * (Configurações → Integrações). Usado tanto na tela do lead quanto na
 * aba Propostas — mesmo componente, mesmo fluxo.
 */
export function OutreachEmailComposer({
  leadId,
  companyId,
  defaultRecipientEmail,
  history,
  gmailConfigured,
}: {
  leadId: string;
  companyId: string;
  defaultRecipientEmail: string | null;
  history: OutreachEmailRow[];
  gmailConfigured: boolean;
}) {
  const [sendState, sendFormAction, isSending] = useActionState(sendOutreachEmailAction, sendInitialState);

  const [recipient, setRecipient] = useState(defaultRecipientEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generateResult, setGenerateResult] = useState<AIActionResult<OutreachMessage>>(generateInitialState);
  const [isGenerating, startGenerate] = useTransition();

  function handleGenerate() {
    const formData = new FormData();
    formData.set("leadId", leadId);
    formData.set("channel", "email");
    startGenerate(async () => {
      const result = await generateOutreachAction(generateInitialState, formData);
      setGenerateResult(result);
      if (result.data?.channel === "email") {
        setSubject(result.data.subject ?? "");
        setBody(result.data.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="E-mail de prospecção (IA)"
        subtitle="Gere um rascunho personalizado a partir da análise do lead, revise e envie pela sua conta Gmail."
      />

      {!gmailConfigured ? (
        <p className="mb-4 text-sm text-[var(--ff-text-secondary)]">
          Conecte sua conta Gmail em Configurações → Integrações para poder enviar e-mails daqui.
          Você ainda pode gerar o rascunho com IA e copiar manualmente.
        </p>
      ) : null}

      <div className="mb-4 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isGenerating}
          onClick={handleGenerate}
          className="gap-1.5"
        >
          <Sparkles className="size-4" aria-hidden />
          {isGenerating ? "Gerando..." : "Gerar rascunho com IA"}
        </Button>
      </div>

      {generateResult.notConfigured ? (
        <p className="mb-3 text-sm text-[var(--ff-text-secondary)]">
          A integração com IA ainda não está configurada nesta organização.
        </p>
      ) : null}
      {!generateResult.notConfigured && generateResult.message && generateResult.status !== "completed" ? (
        <p role="alert" className="mb-3 text-sm text-[var(--ff-danger)]">
          {generateResult.message}
        </p>
      ) : null}

      <form action={sendFormAction} className="flex flex-col gap-3">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="companyId" value={companyId} />
        <Field
          label="Destinatário"
          name="recipientEmail"
          type="email"
          placeholder="contato@empresa.com"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
        />
        <Field
          label="Assunto"
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Gere um rascunho acima ou escreva o seu"
          required
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="outreach-body" className="text-sm font-medium text-[var(--ff-text-secondary)]">
            Mensagem
          </label>
          <textarea
            id="outreach-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Gere um rascunho acima ou escreva sua mensagem"
            className="rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 py-2.5 text-sm text-[var(--ff-text-primary)] outline-none placeholder:text-[var(--ff-text-muted)] focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
            required
          />
        </div>
        {generateResult.data?.follow_up_suggestion ? (
          <p className="text-xs text-[var(--ff-text-muted)]">
            Sugestão de follow-up: {generateResult.data.follow_up_suggestion}
          </p>
        ) : null}

        {sendState.message ? (
          <p role="alert" className={`text-sm ${sendState.success ? "text-[var(--ff-success)]" : "text-[var(--ff-danger)]"}`}>
            {sendState.message}
          </p>
        ) : null}

        <div>
          <Button type="submit" size="sm" disabled={isSending || !gmailConfigured} className="gap-1.5">
            <Mail className="size-4" aria-hidden />
            {isSending ? "Enviando..." : "Enviar e-mail"}
          </Button>
        </div>
      </form>

      {history.length > 0 ? (
        <div className="mt-5 border-t border-[var(--ff-border-subtle)] pt-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--ff-text-muted)] uppercase">
            Histórico de envios
          </p>
          <ul>
            {history.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-0.5 border-b border-[var(--ff-border-subtle)] py-2 text-sm last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={item.status === "sent" ? "success" : "danger"}>
                    {item.status === "sent" ? "Enviado" : "Falhou"}
                  </Badge>
                  <span className="text-[var(--ff-text-primary)]">{item.subject}</span>
                </div>
                <p className="text-xs text-[var(--ff-text-muted)]">
                  Para {item.recipientEmail} · {formatDateTime(item.createdAt)}
                  {item.errorMessage ? ` · ${item.errorMessage}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
