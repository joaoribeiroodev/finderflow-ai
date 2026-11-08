"use client";

import { useActionState, useState } from "react";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  updateCampaignCompanyStatusAction,
  type CampaignActionResult,
} from "@/modules/campaigns/campaigns.actions";
import {
  approveCampaignMessageAction,
  generateCampaignMessageAction,
  saveCampaignMessageDraftAction,
  sendCampaignMessageAction,
  type CampaignMessageActionResult,
} from "@/modules/campaigns/campaign-messages.actions";
import type { CampaignCompanyRow as CampaignCompanyRowType, CampaignCompanyStatus } from "@/modules/campaigns/campaigns.service";
import type { CampaignMessageRow } from "@/modules/campaigns/campaign-messages.service";

const statusInitialState: CampaignActionResult = { success: false };
const messageInitialState: CampaignMessageActionResult = { success: false };

const messageStatusVariant = {
  draft: "outline",
  approved: "warning",
  sent: "success",
  failed: "danger",
} as const;

const messageStatusLabel = {
  draft: "Rascunho",
  approved: "Aprovada — pronta para enviar",
  sent: "Enviada",
  failed: "Falhou",
} as const;

export function CampaignCompanyRow({
  campaignId,
  campaignCompany,
  message,
  statusLabel,
}: {
  campaignId: string;
  campaignCompany: CampaignCompanyRowType;
  message: CampaignMessageRow | null;
  statusLabel: Record<CampaignCompanyStatus, string>;
}) {
  const [statusState, statusAction] = useActionState(updateCampaignCompanyStatusAction, statusInitialState);
  const [generateState, generateAction, isGenerating] = useActionState(
    generateCampaignMessageAction,
    messageInitialState,
  );
  const [saveState, saveAction, isSaving] = useActionState(saveCampaignMessageDraftAction, messageInitialState);
  const [approveState, approveAction, isApproving] = useActionState(
    approveCampaignMessageAction,
    messageInitialState,
  );
  const [sendState, sendAction, isSending] = useActionState(sendCampaignMessageAction, messageInitialState);

  const currentMessage = generateState.data
    ? { subject: generateState.data.subject, body: generateState.data.body }
    : message;

  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="font-medium text-[var(--ff-text-primary)] hover:text-[var(--ff-violet-glow)]"
        >
          {campaignCompany.companyName}
        </button>
        <div className="flex items-center gap-2">
          {message ? (
            <Badge variant={messageStatusVariant[message.status]}>{messageStatusLabel[message.status]}</Badge>
          ) : (
            <Badge variant="outline">Sem rascunho</Badge>
          )}
          <form action={statusAction}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="campaignCompanyId" value={campaignCompany.id} />
            <select
              name="status"
              defaultValue={campaignCompany.status}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="h-9 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-2 text-xs text-[var(--ff-text-primary)] outline-none"
            >
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </form>
        </div>
      </div>
      {statusState.message ? (
        <p className="mt-1 text-xs text-[var(--ff-danger)]">{statusState.message}</p>
      ) : null}

      {expanded ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-[var(--ff-border-subtle)] pt-3">
          <form action={generateAction}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="campaignCompanyId" value={campaignCompany.id} />
            <Button type="submit" size="sm" variant="secondary" disabled={isGenerating} className="gap-1.5">
              <Sparkles className="size-4" aria-hidden />
              {isGenerating ? "Gerando..." : currentMessage ? "Gerar novamente com IA" : "Gerar rascunho com IA"}
            </Button>
          </form>
          {generateState.notConfigured ? (
            <p className="text-sm text-[var(--ff-text-secondary)]">
              A integração com IA ainda não está configurada nesta organização.
            </p>
          ) : null}
          {!generateState.notConfigured && generateState.message && !generateState.success ? (
            <p role="alert" className="text-sm text-[var(--ff-danger)]">
              {generateState.message}
            </p>
          ) : null}

          {message?.status !== "sent" ? (
            <form action={saveAction} className="flex flex-col gap-2">
              <input type="hidden" name="campaignId" value={campaignId} />
              <input type="hidden" name="campaignCompanyId" value={campaignCompany.id} />
              <input
                type="email"
                name="recipientEmail"
                defaultValue={message?.recipientEmail ?? ""}
                placeholder="E-mail de destino"
                className="h-10 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3 text-sm text-[var(--ff-text-primary)] outline-none"
              />
              <input
                type="text"
                name="subject"
                defaultValue={currentMessage?.subject ?? ""}
                placeholder="Assunto"
                className="h-10 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3 text-sm text-[var(--ff-text-primary)] outline-none"
              />
              <textarea
                name="body"
                defaultValue={currentMessage?.body ?? ""}
                rows={6}
                placeholder="Corpo do e-mail"
                className="rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3 py-2 text-sm text-[var(--ff-text-primary)] outline-none"
              />
              <p className="text-xs text-[var(--ff-text-muted)]">
                O texto de descadastro da organização é anexado automaticamente ao final no envio — não precisa
                incluir aqui.
              </p>
              {saveState.message ? (
                <p role={saveState.success ? undefined : "alert"} className="text-sm text-[var(--ff-text-secondary)]">
                  {saveState.message}
                </p>
              ) : null}
              <div>
                <Button type="submit" size="sm" variant="secondary" disabled={isSaving}>
                  {isSaving ? "Salvando..." : "Salvar rascunho"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="rounded-xl border border-[var(--ff-border-subtle)] p-3 text-sm">
              <p className="font-medium text-[var(--ff-text-primary)]">{message.subject}</p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--ff-text-secondary)]">{message.body}</p>
            </div>
          )}

          {message && message.status === "draft" ? (
            <form action={approveAction}>
              <input type="hidden" name="campaignId" value={campaignId} />
              <input type="hidden" name="campaignCompanyId" value={campaignCompany.id} />
              <Button type="submit" size="sm" disabled={isApproving}>
                {isApproving ? "Aprovando..." : "Aprovar mensagem"}
              </Button>
            </form>
          ) : null}
          {approveState.message ? (
            <p role="alert" className="text-sm text-[var(--ff-danger)]">
              {approveState.message}
            </p>
          ) : null}

          {message && message.status === "approved" ? (
            <form action={sendAction}>
              <input type="hidden" name="campaignId" value={campaignId} />
              <input type="hidden" name="campaignCompanyId" value={campaignCompany.id} />
              <Button type="submit" size="sm" disabled={isSending}>
                {isSending ? "Enviando..." : "Enviar agora"}
              </Button>
            </form>
          ) : null}
          {sendState.message ? (
            <p role={sendState.success ? undefined : "alert"} className="text-sm text-[var(--ff-text-secondary)]">
              {sendState.message}
            </p>
          ) : null}
          {message?.status === "failed" && message.errorMessage ? (
            <p role="alert" className="text-sm text-[var(--ff-danger)]">
              Último erro: {message.errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
