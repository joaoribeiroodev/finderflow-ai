"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { recomputeDigitalPresenceScoreAction } from "@/modules/companies/scoring/digital-presence-score.actions";
import type { DigitalPresenceScoreRow } from "@/modules/companies/scoring/digital-presence-score.service";

const initialState = { success: false } as const;

function scoreVariant(score: number): "success" | "warning" | "danger" {
  if (score >= 70) return "success";
  if (score >= 35) return "warning";
  return "danger";
}

/**
 * "Presença Digital" (Módulo 3) — pontuação 0-100 calculada por uma
 * fórmula de pesos transparente sobre os dados da empresa (nunca por
 * IA). Recalculada automaticamente quando uma proposta de enriquecimento
 * é aceita (Módulo 1); o botão aqui é só para empresas com dados
 * anteriores ao Módulo 1 existir, que nunca passaram por esse gatilho.
 */
export function DigitalPresenceScoreCard({
  companyId,
  latestScore,
}: {
  companyId: string;
  latestScore: DigitalPresenceScoreRow | null;
}) {
  const [state, formAction, isPending] = useActionState(recomputeDigitalPresenceScoreAction, initialState);

  const score = state.success && typeof state.score === "number" ? state.score : latestScore?.score ?? null;
  const signals = latestScore?.criteria.signals;

  return (
    <Card>
      <CardHeader
        title="Presença digital"
        subtitle="Pontuação 0-100 calculada por fórmula (site, e-mail, telefone e redes sociais) — nunca por IA."
        action={
          <form action={formAction}>
            <input type="hidden" name="companyId" value={companyId} />
            <Button type="submit" size="sm" variant="secondary" disabled={isPending} className="gap-1.5">
              <RefreshCw className="size-4" aria-hidden />
              {isPending ? "Calculando..." : "Recalcular"}
            </Button>
          </form>
        }
      />

      {state.message ? (
        <p role="alert" className="mb-3 text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}

      {score === null ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">
          Pontuação ainda não calculada — clique em &quot;Recalcular&quot; para gerar a primeira.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-[var(--ff-text-primary)]">{score}</span>
            <span className="text-sm text-[var(--ff-text-secondary)]">/ 100</span>
            <Badge variant={scoreVariant(score)}>{score >= 70 ? "Forte" : score >= 35 ? "Moderada" : "Fraca"}</Badge>
          </div>
          {signals ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant={signals.hasWebsite ? "success" : "outline"}>Site</Badge>
              <Badge variant={signals.hasEmail ? "success" : "outline"}>E-mail</Badge>
              <Badge variant={signals.hasPhone ? "success" : "outline"}>Telefone</Badge>
              <Badge variant={signals.socialPlatformCount > 0 ? "success" : "outline"}>
                {signals.socialPlatformCount} rede{signals.socialPlatformCount === 1 ? "" : "s"} social
                {signals.socialPlatformCount === 1 ? "" : "is"}
              </Badge>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
