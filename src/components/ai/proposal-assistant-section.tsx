"use client";

import { useActionState } from "react";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatBRL } from "@/lib/utils/format";
import type { ProposalDraft } from "@/lib/ai/schemas";
import { generateProposalDraftAction, type AIActionResult } from "@/modules/ai/actions";

const initialState: AIActionResult<ProposalDraft> = { success: false };

/**
 * Proposal Assistant: rascunho de escopo/itens de proposta. Deixa
 * explícito que nada é salvo automaticamente — o vendedor usa o
 * rascunho como referência ao montar os itens em "Nova proposta"
 * manualmente (mesmo princípio de revisão humana do Outreach Generator).
 */
export function ProposalAssistantSection({ leadId }: { leadId: string }) {
  const [state, formAction, isPending] = useActionState(generateProposalDraftAction, initialState);

  return (
    <Card>
      <CardHeader
        title="Rascunho de proposta (IA)"
        subtitle="Sugestão de escopo e itens a partir do catálogo — nada é salvo automaticamente."
      />

      <form action={formAction} className="mb-4">
        <input type="hidden" name="leadId" value={leadId} />
        <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
          <FileText className="size-4" aria-hidden />
          {isPending ? "Gerando..." : "Gerar rascunho de proposta"}
        </Button>
      </form>

      {state.notConfigured ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">
          A integração com IA ainda não está configurada neste ambiente. Configure a chave da OpenAI para
          habilitar o rascunho de proposta.
        </p>
      ) : null}

      {!state.notConfigured && state.message && state.status !== "completed" ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}

      {state.data ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-[var(--ff-text-primary)]">{state.data.scope_summary}</p>
          <ul className="flex flex-col gap-2">
            {state.data.items.map((item, i) => (
              <li key={i} className="rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--ff-text-primary)]">{item.service_name}</span>
                  <span className="ff-tabular-nums text-xs text-[var(--ff-text-secondary)]">
                    {item.suggested_quantity}x {formatBRL(item.suggested_unit_price)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--ff-text-secondary)]">{item.description}</p>
                <p className="mt-1 text-xs text-[var(--ff-text-muted)]">{item.rationale}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--ff-text-muted)]">
            Validade sugerida: {state.data.suggested_valid_days} dias. {state.data.notes}
          </p>
          <p className="text-xs text-[var(--ff-text-secondary)]">
            Use este rascunho como referência em “Propostas → Nova proposta” — os itens precisam ser
            adicionados manualmente, assim como qualquer outro conteúdo gerado por IA neste produto.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
