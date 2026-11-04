"use client";

import { useRef, useState, useTransition } from "react";
import { Send, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  confirmPendingToolCallAction,
  rejectPendingToolCallAction,
  sendCopilotMessageAction,
  type CopilotActionResult,
} from "@/modules/ai/copilot-actions";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const EMPTY_PREV: CopilotActionResult = { success: false };

/**
 * Chat do Copilot. Mantém uma lista local (otimista) de mensagens
 * visíveis, seedada pelo histórico persistido (`initialMessages`), e
 * acrescenta cada novo turno diretamente no handler que dispara a
 * Server Action (nunca num `useEffect` — ver o bug de lint da Fase 4,
 * `react-hooks/set-state-in-effect`, que levou a essa mesma decisão de
 * design em `StageRow`). A persistência real continua em
 * `ai_messages`/`ai_conversations` (fonte da verdade); este estado local
 * só evita esperar uma navegação completa para ver a resposta.
 */
export function CopilotChat({
  conversationId,
  initialMessages,
  initialPendingConfirmation,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  initialPendingConfirmation: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(initialPendingConfirmation);
  const [notConfigured, setNotConfigured] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function applyResult(result: CopilotActionResult) {
    setErrorMessage(null);
    setNotConfigured(false);

    if (result.notConfigured) {
      setNotConfigured(true);
      return;
    }
    if (!result.turn) {
      if (result.message) setErrorMessage(result.message);
      return;
    }
    const turn = result.turn;
    if (turn.kind === "message") {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: turn.text }]);
      setPendingConfirmation(null);
    } else if (turn.kind === "pending_confirmation") {
      setPendingConfirmation(turn.description);
    } else {
      setErrorMessage(turn.message);
      setPendingConfirmation(null);
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleSend(formData: FormData) {
    const text = String(formData.get("text") ?? "").trim();
    if (text.length === 0) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
    formRef.current?.reset();

    startTransition(async () => {
      const result = await sendCopilotMessageAction(EMPTY_PREV, formData);
      applyResult(result);
    });
  }

  function handleConfirm() {
    const formData = new FormData();
    formData.set("conversationId", conversationId);
    startTransition(async () => {
      const result = await confirmPendingToolCallAction(EMPTY_PREV, formData);
      applyResult(result);
    });
  }

  function handleReject() {
    const formData = new FormData();
    formData.set("conversationId", conversationId);
    startTransition(async () => {
      const result = await rejectPendingToolCallAction(EMPTY_PREV, formData);
      applyResult(result);
    });
  }

  return (
    <Card className="flex flex-1 flex-col overflow-hidden p-0">
      <div className="flex-1 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--ff-text-muted)]">
            Pergunte sobre leads, tarefas, métricas do funil, ou peça para criar uma tarefa ou mover um lead
            de etapa (vai pedir sua confirmação antes).
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-[var(--ff-radius-md)] px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto bg-[var(--ff-purple-600)] text-white"
                    : "border border-[var(--ff-border-subtle)] text-[var(--ff-text-primary)]"
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
        )}

        {notConfigured ? (
          <p className="mt-3 text-sm text-[var(--ff-text-secondary)]">
            A integração com IA ainda não está configurada neste ambiente.
          </p>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="mt-3 text-sm text-[var(--ff-danger)]">
            {errorMessage}
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {pendingConfirmation ? (
        <div className="border-t border-[var(--ff-border-subtle)] bg-[rgba(251,146,60,0.08)] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--ff-text-primary)]">
            <ShieldAlert className="size-4 text-[#f9d57b]" aria-hidden />
            Confirmação necessária
          </div>
          <p className="mb-3 text-sm text-[var(--ff-text-secondary)]">{pendingConfirmation}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={isPending} onClick={handleConfirm}>
              Confirmar
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={handleReject}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <form
          ref={formRef}
          action={handleSend}
          className="flex items-center gap-2 border-t border-[var(--ff-border-subtle)] p-4"
        >
          <input
            name="text"
            placeholder="Pergunte algo ao Copilot..."
            autoComplete="off"
            disabled={isPending}
            className="h-11 flex-1 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-elevated)] px-3 text-sm text-[var(--ff-text-primary)] placeholder:text-[var(--ff-text-muted)]"
          />
          <input type="hidden" name="conversationId" value={conversationId} />
          <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
            <Send className="size-4" aria-hidden />
            {isPending ? "Enviando..." : "Enviar"}
          </Button>
        </form>
      )}
    </Card>
  );
}
