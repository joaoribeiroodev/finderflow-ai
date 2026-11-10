import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganizationForPage } from "@/modules/organizations/active-organization";
import { listActiveServices } from "@/modules/services/services.service";
import {
  listServiceRecommendations,
  summarizeByService,
} from "@/modules/services/recommendations/recommendations.service";
import type { RecommendationPriority } from "@/modules/services/recommendations/rank-recommendations";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Recomendações de serviços — FinderFlow AI" };

const priorityVariant: Record<RecommendationPriority, "outline" | "warning" | "danger"> = {
  low: "outline",
  medium: "warning",
  high: "danger",
};

const priorityLabel: Record<RecommendationPriority, string> = {
  low: "baixa",
  medium: "média",
  high: "alta",
};

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceId?: string; priority?: string }>;
}) {
  const params = await searchParams;
  const activeOrganization = await requireActiveOrganizationForPage();
  const supabase = await createClient();

  const priorityFilter =
    params.priority === "low" || params.priority === "medium" || params.priority === "high"
      ? params.priority
      : undefined;

  const [services, recommendations] = await Promise.all([
    listActiveServices(supabase, activeOrganization.organizationId),
    listServiceRecommendations(supabase, activeOrganization.organizationId, {
      serviceId: params.serviceId || undefined,
      priority: priorityFilter,
    }),
  ]);

  const summary = summarizeByService(recommendations);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção"
        title="Recomendações de serviços"
        subtitle="Oportunidades identificadas pela Análise com IA (empresa por empresa), reunidas aqui numa lista única — sem precisar abrir cada empresa individualmente."
      />

      {summary.length > 0 ? (
        <Card>
          <CardHeader
            title="Resumo por serviço"
            subtitle="Quantas oportunidades abertas existem hoje para cada serviço do catálogo."
          />
          <div className="flex flex-wrap gap-2">
            {summary.map((entry) => (
              <Badge key={entry.serviceId ?? entry.serviceName} variant="outline" className="gap-1.5">
                {entry.serviceName}: {entry.count}
                {entry.highPriorityCount > 0 ? ` (${entry.highPriorityCount} alta prioridade)` : ""}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <form className="flex flex-wrap items-end gap-3" action="/recommendations">
          <div className="flex min-w-[220px] flex-col gap-1.5">
            <label htmlFor="serviceId" className="text-sm font-medium text-[var(--ff-text-secondary)]">
              Serviço
            </label>
            <select
              id="serviceId"
              name="serviceId"
              defaultValue={params.serviceId ?? ""}
              className="h-11 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 text-[var(--ff-text-primary)] outline-none focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
            >
              <option value="">Todos os serviços</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[180px] flex-col gap-1.5">
            <label htmlFor="priority" className="text-sm font-medium text-[var(--ff-text-secondary)]">
              Prioridade
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue={params.priority ?? ""}
              className="h-11 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 text-[var(--ff-text-primary)] outline-none focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
            >
              <option value="">Todas</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
          <button
            type="submit"
            className="h-11 rounded-xl bg-[var(--ff-purple-500)] px-4 text-sm font-medium text-white"
          >
            Filtrar
          </button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Oportunidades"
          subtitle={`${recommendations.length} oportunidade${recommendations.length === 1 ? "" : "s"} encontrada${recommendations.length === 1 ? "" : "s"}.`}
        />

        {recommendations.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="Nenhuma oportunidade encontrada"
            description="Rode a Análise com IA nas páginas de empresa para gerar oportunidades, ou ajuste os filtros acima."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {recommendations.map((rec, i) => (
              <li
                key={`${rec.analysisId}-${i}`}
                className="rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/companies/${rec.companyId}`}
                    className="font-medium text-[var(--ff-text-primary)] hover:text-[var(--ff-violet-glow)]"
                  >
                    {rec.companyName}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{rec.serviceName}</Badge>
                    <Badge variant={priorityVariant[rec.priority]}>Prioridade {priorityLabel[rec.priority]}</Badge>
                  </div>
                </div>
                <p className="mt-1 text-sm text-[var(--ff-text-secondary)]">{rec.reason}</p>
                <p className="mt-1 text-xs text-[var(--ff-text-muted)]">
                  {rec.companyScore !== null ? `Potencial da empresa: ${rec.companyScore}/100 — ` : ""}
                  analisado {formatRelativeDateTime(rec.analyzedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
