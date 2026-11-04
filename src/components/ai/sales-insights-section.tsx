"use client";

import { useActionState, useState } from "react";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/ui/chart-card";
import type { SalesInsights } from "@/lib/ai/schemas";
import { generateSalesInsightsAction, type AIActionResult } from "@/modules/ai/actions";

const initialState: AIActionResult<SalesInsights> = { success: false };

const PERIOD_OPTIONS = [
  { value: "last_30_days", label: "Últimos 30 dias" },
  { value: "current_month", label: "Mês atual" },
  { value: "last_90_days", label: "Últimos 90 dias" },
] as const;

/**
 * Sales Analyst (FF-085 "Insights IA com evidência e período"). O
 * período exibido vem sempre do próprio resultado da IA
 * (`state.data.period_label`), que por sua vez ecoa o período calculado
 * no servidor — nunca um texto fixo que poderia divergir do que foi
 * realmente analisado.
 */
export function SalesInsightsSection() {
  const [state, formAction, isPending] = useActionState(generateSalesInsightsAction, initialState);
  const [period, setPeriod] = useState<string>("last_30_days");

  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-[var(--ff-violet-glow)]" aria-hidden /> Insights IA (Sales Analyst)
        </span>
      }
      subtitle="Interpretação de métricas reais do período — a IA nunca calcula os números, só analisa."
      action={<Badge variant="outline">Fase 7</Badge>}
      className="border-[#55347a] bg-[linear-gradient(100deg,#281743,#1b1430_60%,#201332)]"
    >
      <form action={formAction} className="mb-4 flex items-center gap-2">
        <select
          name="period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-9 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-elevated)] px-3 text-sm text-[var(--ff-text-primary)]"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Analisando..." : "Gerar insights"}
        </Button>
      </form>

      {state.notConfigured ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">
          A integração com IA ainda não está configurada neste ambiente. Configure a chave da OpenAI para
          habilitar os insights automáticos.
        </p>
      ) : null}

      {!state.notConfigured && !state.data ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">
          Escolha um período e gere a análise — nenhuma análise é inventada antes disso.
        </p>
      ) : null}

      {!state.notConfigured && state.message && state.status !== "completed" ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}

      {state.data ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-xs text-[var(--ff-text-muted)]">Período: {state.data.period_label}</p>
          <p className="font-medium text-[var(--ff-text-primary)]">{state.data.headline}</p>
          <ul className="flex flex-col gap-2">
            {state.data.insights.map((insight, i) => (
              <li key={i} className="rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3">
                <p className="text-[var(--ff-text-primary)]">{insight.claim}</p>
                <p className="mt-1 text-xs text-[var(--ff-text-secondary)]">Evidência: {insight.evidence}</p>
              </li>
            ))}
          </ul>
          {state.data.risks.length > 0 ? (
            <div>
              <h4 className="mb-1 text-xs font-semibold tracking-wide text-[var(--ff-text-muted)] uppercase">
                Riscos / limitações
              </h4>
              <ul className="list-inside list-disc text-xs text-[var(--ff-text-secondary)]">
                {state.data.risks.map((risk, i) => (
                  <li key={i}>{risk}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <h4 className="mb-1 text-xs font-semibold tracking-wide text-[var(--ff-text-muted)] uppercase">
              Ações recomendadas
            </h4>
            <ul className="list-inside list-disc text-xs text-[var(--ff-text-secondary)]">
              {state.data.recommended_actions.map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </ChartCard>
  );
}
