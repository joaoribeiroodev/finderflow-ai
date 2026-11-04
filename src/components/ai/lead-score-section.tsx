"use client";

import { useActionState } from "react";
import { Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { LEAD_SCORE_CRITERIA, type LeadScoreResult } from "@/lib/ai/schemas";
import { type AIActionResult, scoreLeadAction } from "@/modules/ai/actions";

const initialState: AIActionResult<LeadScoreResult> = { success: false };

const criterionLabel = Object.fromEntries(LEAD_SCORE_CRITERIA.map((c) => [c.key, c.label]));

/**
 * Seção de qualificação de lead por IA. O rótulo exibido é sempre
 * "placar de qualificação" — nunca "probabilidade de compra" (regra de
 * negócio explícita do prompt mestre, docs/05-integrations.md).
 */
export function LeadScoreSection({
  leadId,
  initialScore,
}: {
  leadId: string;
  initialScore: LeadScoreResult | null;
}) {
  const [state, formAction, isPending] = useActionState(scoreLeadAction, initialState);

  const score = state.data ?? initialScore;

  return (
    <Card>
      <CardHeader
        title="Qualificação por IA"
        subtitle="Placar ponderado de 0 a 100 — não é uma previsão de probabilidade de compra."
        action={
          <form action={formAction}>
            <input type="hidden" name="leadId" value={leadId} />
            <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
              <Target className="size-4" aria-hidden />
              {isPending ? "Qualificando..." : score ? "Qualificar novamente" : "Qualificar com IA"}
            </Button>
          </form>
        }
      />

      {state.notConfigured ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">
          A integração com IA ainda não está configurada neste ambiente. Configure a chave da OpenAI para
          habilitar a qualificação automática de leads.
        </p>
      ) : null}

      {!state.notConfigured && state.message && state.status !== "completed" ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}

      {!score ? (
        !state.notConfigured && !state.message ? (
          <p className="text-sm text-[var(--ff-text-secondary)]">Este lead ainda não foi qualificado por IA.</p>
        ) : null
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <Badge variant="default">Placar: {score.score}/100</Badge>
          <p className="text-[var(--ff-text-primary)]">{score.summary}</p>

          <ul className="flex flex-col gap-2">
            {score.score_breakdown.map((item) => (
              <li
                key={item.criterion}
                className="rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--ff-text-primary)]">
                    {criterionLabel[item.criterion] ?? item.criterion}
                  </span>
                  <span className="text-[var(--ff-text-secondary)]">{item.score}/100</span>
                </div>
                <p className="mt-1 text-xs text-[var(--ff-text-secondary)]">{item.rationale}</p>
              </li>
            ))}
          </ul>

          <div>
            <h4 className="mb-1 text-xs font-semibold tracking-wide text-[var(--ff-text-muted)] uppercase">
              Ação recomendada
            </h4>
            <p className="text-[var(--ff-text-primary)]">{score.recommended_action}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
