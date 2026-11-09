import type { Metadata } from "next";
import { Building2, CheckSquare, FileText, Rows3, History } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganizationForPage } from "@/modules/organizations/active-organization";
import { getDashboardData, getSegmentsAndOrigins, getTrendData } from "@/modules/dashboard/dashboard.service";
import { SalesInsightsSection } from "@/components/ai/sales-insights-section";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard, FunnelRow } from "@/components/ui/chart-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRL, formatRelativeDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Visão geral — FinderFlow AI" };

export default async function DashboardPage() {
  const activeOrganization = await requireActiveOrganizationForPage();
  const supabase = await createClient();
  const [data, trend, breakdown] = await Promise.all([
    getDashboardData(supabase, activeOrganization.organizationId),
    getTrendData(supabase, activeOrganization.organizationId),
    getSegmentsAndOrigins(supabase, activeOrganization.organizationId),
  ]);

  const maxStageCount = Math.max(1, ...data.pipeline.map((s) => s.count));
  const maxLeadsTrend = Math.max(1, ...trend.leadsCreated.map((b) => b.value));
  const maxRevenueTrend = Math.max(1, ...trend.wonRevenue.map((b) => b.value));
  const maxSegmentCount = Math.max(1, ...breakdown.segments.map((s) => s.count));
  const maxOriginCount = Math.max(1, ...breakdown.origins.map((s) => s.count));

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-[var(--ff-border-subtle)] pb-5">
        <PageHeader
          eyebrow="Seu painel de crescimento"
          title={
            <>
              Bem-vindo(a), {activeOrganization.organizationName}{" "}
              <span className="text-[var(--ff-violet-glow)]">✦</span>
            </>
          }
          subtitle="Aqui está o resumo real da sua operação comercial nesta organização."
        />
      </div>

      <section className="border-l-2 border-[var(--ff-brass)] bg-[var(--ff-bg-surface)] px-5 py-6 sm:px-8">
        <p className="mb-2 text-sm text-[var(--ff-text-muted)]">Valor ponderado em negociação</p>
        <p className="font-serif text-4xl tracking-tight text-[var(--ff-brass-soft)] sm:text-6xl">
          {formatBRL(data.weightedPipelineValue)}
        </p>
        <p className="mt-2 text-sm text-[var(--ff-text-secondary)]">
          O registro financeiro estimado do pipeline ativo.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Empresas cadastradas" value={data.companiesCount.toLocaleString("pt-BR")} icon={Building2} />
        <KpiCard label="Leads ativos" value={data.activeLeadsCount.toLocaleString("pt-BR")} icon={Rows3} />
        <KpiCard label="Propostas enviadas" value={data.proposalsSentCount.toLocaleString("pt-BR")} icon={FileText} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ChartCard
          title="Funil de vendas"
          subtitle="Distribuição de leads por etapa do pipeline"
        >
          {data.pipeline.length === 0 ? (
            <EmptyState
              icon={Rows3}
              title="Nenhuma etapa de pipeline encontrada"
              description="As etapas padrão são criadas automaticamente ao criar a organização."
            />
          ) : (
            data.pipeline.map((stage) => (
              <FunnelRow
                key={stage.id}
                label={stage.name}
                count={stage.count}
                max={maxStageCount}
                color={stage.color}
              />
            ))
          )}
        </ChartCard>

        <ChartCard title="Próximas ações" subtitle="Tarefas pendentes atribuídas na organização">
          {data.pendingTasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="Nenhuma tarefa pendente"
              description="Tarefas aparecerão aqui quando você criar follow-ups nos leads."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--ff-border-subtle)]">
              {data.pendingTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="truncate text-[var(--ff-text-primary)]">{task.title}</span>
                  <span className="shrink-0 text-xs text-[var(--ff-text-muted)]">
                    {task.dueAt ? formatRelativeDateTime(task.dueAt) : "Sem prazo"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Atividade recente" subtitle="Mudanças de etapa no seu pipeline">
        {data.recentActivity.length === 0 ? (
          <EmptyState
            icon={History}
            title="Ainda não há atividade registrada"
            description="O histórico de mudanças de etapa aparecerá aqui conforme leads avançarem no pipeline."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--ff-border-subtle)]">
            {data.recentActivity.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-[var(--ff-text-primary)]">
                  <b>{item.companyName}</b> avançou para{" "}
                  <span className="text-[var(--ff-violet-glow)]">{item.toStageName}</span>
                </span>
                <span className="shrink-0 text-xs text-[var(--ff-text-muted)]">
                  {formatRelativeDateTime(item.changedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <ChartCard title="Tendência de leads" subtitle="Leads criados por mês (últimos 6 meses)">
          {trend.leadsCreated.every((b) => b.value === 0) ? (
            <EmptyState icon={Rows3} title="Sem leads no período" />
          ) : (
            trend.leadsCreated.map((bucket) => (
              <FunnelRow key={bucket.key} label={bucket.label} count={bucket.value} max={maxLeadsTrend} />
            ))
          )}
        </ChartCard>

        <ChartCard title="Tendência de receita" subtitle="Negócios ganhos por mês (últimos 6 meses)">
          {trend.wonRevenue.every((b) => b.value === 0) ? (
            <EmptyState icon={FileText} title="Nenhum negócio ganho no período" />
          ) : (
            trend.wonRevenue.map((bucket) => (
              <div key={bucket.key} className="my-3 grid grid-cols-[minmax(0,60px)_1fr_auto] items-center gap-2.5 text-xs">
                <span className="text-[var(--ff-text-secondary)]">{bucket.label}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--ff-bg-elevated)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${maxRevenueTrend > 0 ? Math.max((bucket.value / maxRevenueTrend) * 100, bucket.value > 0 ? 4 : 0) : 0}%`,
                      background: "linear-gradient(90deg, var(--ff-purple-500), var(--ff-magenta))",
                    }}
                  />
                </div>
                <b className="ff-tabular-nums text-[var(--ff-text-primary)]">{formatBRL(bucket.value)}</b>
              </div>
            ))
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <ChartCard title="Segmentos" subtitle="Empresas por categoria">
          {breakdown.segments.length === 0 ? (
            <EmptyState icon={Building2} title="Nenhuma empresa cadastrada" />
          ) : (
            breakdown.segments.map((segment) => (
              <FunnelRow key={segment.key} label={segment.label} count={segment.count} max={maxSegmentCount} />
            ))
          )}
        </ChartCard>

        <ChartCard title="Origens" subtitle="Empresas por origem de cadastro">
          {breakdown.origins.length === 0 ? (
            <EmptyState icon={Building2} title="Nenhuma empresa cadastrada" />
          ) : (
            breakdown.origins.map((origin) => (
              <FunnelRow key={origin.key} label={origin.label} count={origin.count} max={maxOriginCount} />
            ))
          )}
        </ChartCard>
      </div>

      <SalesInsightsSection />
    </div>
  );
}
