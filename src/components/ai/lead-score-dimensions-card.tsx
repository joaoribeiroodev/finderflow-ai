"use client";

import { useActionState } from "react";
import { Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { recomputeLeadScoreDimensionsAction } from "@/modules/leads/scoring/lead-score-dimensions.actions";
import type { LeadScoreDimensionsRow } from "@/modules/leads/scoring/lead-score-dimensions.service";

const initialState = { success: false } as const;

function badgeVariant(score: number): "success" | "warning" | "danger" {
  if (score >= 70) return "success";
  if (score >= 35) return "warning";
  return "danger";
}

/**
 * Módulo 4 — Lead Scoring 2.0. Decomposição do placar único do Lead
 * Scorer (ver `LeadScoreSection`) em 3 dimensões — nunca uma nova
 * chamada de IA, é uma reagregação determinística dos mesmos números.
 * Atualizado automaticamente a cada qualificação; o botão aqui serve só
 * para leads qualificados antes deste módulo existir.
 */
export function LeadScoreDimensionsCard({
  leadId,
  initialDimensions,
}: {
  leadId: string;
  initialDimensions: LeadScoreDimensionsRow | null;
}) {
  const [state, formAction, isPending] = useActionState(recomputeLeadScoreDimensionsAction, initialState);

  return (
    <Card>
      <CardHeader
        title="Dimensões da qualificação"
        subtitle="Potencial, aderência e prioridade — reagregação determinística do placar acima, não uma nova análise de IA."
        action={
          !initialDimensions ? (
            <form action={formAction}>
              <input type="hidden" name="leadId" value={leadId} />
              <Button type="submit" size="sm" variant="secondary" disabled={isPending} className="gap-1.5">
                <Layers className="size-4" aria-hidden />
                {isPending ? "Calculando..." : "Calcular dimensões"}
              </Button>
            </form>
          ) : undefined
        }
      />

      {state.message ? (
        <p role={state.success ? undefined : "alert"} className="mb-3 text-sm text-[var(--ff-text-secondary)]">
          {state.message}
        </p>
      ) : null}

      {!initialDimensions ? (
        !state.message ? (
          <p className="text-sm text-[var(--ff-text-secondary)]">
            Nenhuma dimensão calculada ainda — qualifique este lead por IA (seção acima) para gerar a primeira.
          </p>
        ) : null
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3">
            <span className="text-xs text-[var(--ff-text-muted)] uppercase">Potencial</span>
            <Badge variant={badgeVariant(initialDimensions.potentialScore)} className="w-fit">
              {initialDimensions.potentialScore}/100
            </Badge>
          </div>
          <div className="flex flex-col gap-1 rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3">
            <span className="text-xs text-[var(--ff-text-muted)] uppercase">Aderência</span>
            <Badge variant={badgeVariant(initialDimensions.fitScore)} className="w-fit">
              {initialDimensions.fitScore}/100
            </Badge>
          </div>
          <div className="flex flex-col gap-1 rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3">
            <span className="text-xs text-[var(--ff-text-muted)] uppercase">Prioridade</span>
            <Badge variant={badgeVariant(initialDimensions.priorityScore)} className="w-fit">
              {initialDimensions.priorityScore}/100
            </Badge>
          </div>
        </div>
      )}
    </Card>
  );
}
