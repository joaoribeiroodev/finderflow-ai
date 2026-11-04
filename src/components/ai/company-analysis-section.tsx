"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { CompanyAnalysis } from "@/lib/ai/schemas";
import { analyzeCompanyAction, type AIActionResult } from "@/modules/ai/actions";

const initialState: AIActionResult<CompanyAnalysis> = { success: false };

const priorityVariant = { low: "outline", medium: "warning", high: "danger" } as const;
const confidenceLabel = { low: "baixa confiança", medium: "confiança média", high: "alta confiança" } as const;

/**
 * Seção de "Análise com IA" na página de detalhe da empresa. Mostra, sem
 * ambiguidade, um dos quatro estados possíveis de uma chamada de IA
 * (Fase 5): não configurada, recusada, incompleta/falha, ou concluída —
 * nunca finge sucesso quando não houve.
 */
export function CompanyAnalysisSection({
  companyId,
  initialAnalysis,
}: {
  companyId: string;
  initialAnalysis: CompanyAnalysis | null;
}) {
  const [state, formAction, isPending] = useActionState(analyzeCompanyAction, initialState);

  const analysis = state.data ?? initialAnalysis;

  return (
    <Card>
      <CardHeader
        title="Análise com IA"
        subtitle="Resumo, observações e oportunidades identificadas pela IA a partir dos dados cadastrados."
        action={
          <form action={formAction}>
            <input type="hidden" name="companyId" value={companyId} />
            <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
              <Sparkles className="size-4" aria-hidden />
              {isPending ? "Analisando..." : analysis ? "Analisar novamente" : "Analisar com IA"}
            </Button>
          </form>
        }
      />

      {state.notConfigured ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">
          A integração com IA ainda não está configurada neste ambiente. Configure a chave da OpenAI para
          habilitar a análise automática de empresas.
        </p>
      ) : null}

      {!state.notConfigured && state.message && state.status !== "completed" ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}

      {!analysis ? (
        !state.notConfigured && !state.message ? (
          <p className="text-sm text-[var(--ff-text-secondary)]">
            Nenhuma análise gerada ainda para esta empresa.
          </p>
        ) : null
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex items-center gap-3">
            <Badge variant="default">Potencial: {analysis.score}/100</Badge>
          </div>
          <p className="text-[var(--ff-text-primary)]">{analysis.summary}</p>

          {analysis.observations.length > 0 ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-[var(--ff-text-muted)] uppercase">
                Observações
              </h4>
              <ul className="flex flex-col gap-2">
                {analysis.observations.map((obs, i) => (
                  <li key={i} className="rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3">
                    <p className="text-[var(--ff-text-primary)]">{obs.claim}</p>
                    <p className="mt-1 text-xs text-[var(--ff-text-secondary)]">
                      {obs.evidence} — {confidenceLabel[obs.confidence]}
                      {obs.kind === "inference" ? " (inferência)" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.opportunities.length > 0 ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-[var(--ff-text-muted)] uppercase">
                Oportunidades
              </h4>
              <ul className="flex flex-col gap-2">
                {analysis.opportunities.map((opp, i) => (
                  <li key={i} className="rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--ff-text-primary)]">{opp.service_name}</span>
                      <Badge variant={priorityVariant[opp.priority]}>{opp.priority}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--ff-text-secondary)]">{opp.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h4 className="mb-1 text-xs font-semibold tracking-wide text-[var(--ff-text-muted)] uppercase">
              Ação recomendada
            </h4>
            <p className="text-[var(--ff-text-primary)]">{analysis.recommended_action}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
