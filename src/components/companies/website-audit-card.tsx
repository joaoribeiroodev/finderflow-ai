"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Gauge, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { runWebsiteAuditAction } from "@/modules/companies/website-audit/website-audit.actions";
import type { WebsiteAuditRow } from "@/modules/companies/website-audit/website-audit.service";
import { formatRelativeDateTime } from "@/lib/utils/format";

const initialState = { success: false } as const;

function scoreVariant(score: number): "success" | "warning" | "danger" {
  if (score >= 90) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function ScoreGauge({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-[var(--ff-border-subtle)] px-3 py-2.5">
      {score === null ? (
        <span className="text-xl font-semibold text-[var(--ff-text-muted)]">—</span>
      ) : (
        <Badge variant={scoreVariant(score)} className="text-base font-semibold">
          {score}
        </Badge>
      )}
      <span className="text-xs text-[var(--ff-text-muted)]">{label}</span>
    </div>
  );
}

/**
 * Módulo 2 — Website Audit. Pontuações e Core Web Vitals vêm 100% da
 * Google PageSpeed Insights API (gratuita) — o FinderFlow nunca calcula
 * ou interpreta esses números, só exibe o que a API retornou.
 */
export function WebsiteAuditCard({
  companyId,
  hasWebsite,
  pagespeedConfigured,
  latestAudit,
}: {
  companyId: string;
  hasWebsite: boolean;
  pagespeedConfigured: boolean;
  latestAudit: WebsiteAuditRow | null;
}) {
  const [state, formAction, isPending] = useActionState(runWebsiteAuditAction, initialState);

  const canRun = hasWebsite && pagespeedConfigured;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Gauge className="size-4 text-[var(--ff-violet-glow)]" aria-hidden /> Auditoria de site
          </span>
        }
        subtitle="Desempenho, acessibilidade, boas práticas e SEO — via Google PageSpeed Insights (gratuito)."
        action={
          <form action={formAction}>
            <input type="hidden" name="companyId" value={companyId} />
            <Button type="submit" size="sm" variant="secondary" disabled={isPending || !canRun} className="gap-1.5">
              <RefreshCw className="size-4" aria-hidden />
              {isPending ? "Auditando..." : "Rodar auditoria"}
            </Button>
          </form>
        }
      />

      {!hasWebsite ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">
          Cadastre o site desta empresa para poder rodar uma auditoria.
        </p>
      ) : !pagespeedConfigured ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">
          Configure sua chave gratuita da PageSpeed Insights em{" "}
          <Link href="/settings" className="text-[var(--ff-violet-glow)] hover:underline">
            Configurações → Integrações
          </Link>{" "}
          para rodar auditorias de site.
        </p>
      ) : null}

      {state.message ? (
        <p role="alert" className="mb-3 text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}

      {latestAudit?.status === "failed" && !state.message ? (
        <p role="alert" className="mb-3 text-sm text-[var(--ff-danger)]">
          Última tentativa falhou: {latestAudit.errorMessage ?? "erro desconhecido"}
        </p>
      ) : null}

      {latestAudit && latestAudit.status === "completed" ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ScoreGauge label="Desempenho" score={latestAudit.performanceScore} />
            <ScoreGauge label="Acessibilidade" score={latestAudit.accessibilityScore} />
            <ScoreGauge label="Boas práticas" score={latestAudit.bestPracticesScore} />
            <ScoreGauge label="SEO" score={latestAudit.seoScore} />
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-[var(--ff-text-muted)]">
            {latestAudit.largestContentfulPaintMs !== null ? (
              <span>LCP: {(latestAudit.largestContentfulPaintMs / 1000).toFixed(1)}s</span>
            ) : null}
            {latestAudit.cumulativeLayoutShift !== null ? (
              <span>CLS: {latestAudit.cumulativeLayoutShift.toFixed(2)}</span>
            ) : null}
            {latestAudit.totalBlockingTimeMs !== null ? (
              <span>TBT: {Math.round(latestAudit.totalBlockingTimeMs)}ms</span>
            ) : null}
            <span>Auditado {formatRelativeDateTime(latestAudit.runAt)}</span>
          </div>

          {latestAudit.issues.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase text-[var(--ff-text-muted)]">
                Principais pontos de melhoria
              </p>
              <ul className="flex flex-col gap-1.5">
                {latestAudit.issues.map((issue) => (
                  <li key={issue.id} className="text-sm text-[var(--ff-text-secondary)]">
                    <span className="font-medium text-[var(--ff-text-primary)]">{issue.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : !latestAudit ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">
          Nenhuma auditoria rodada ainda{canRun ? ' — clique em "Rodar auditoria".' : "."}
        </p>
      ) : null}
    </Card>
  );
}
