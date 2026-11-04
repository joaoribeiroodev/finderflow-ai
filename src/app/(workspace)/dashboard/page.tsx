import type { Metadata } from "next";
import { Building2, CheckSquare, FileText, Rows3, Sparkles, History } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { getDashboardData } from "@/modules/dashboard/dashboard.service";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard, FunnelRow } from "@/components/ui/chart-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatRelativeDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Visão geral — FinderFlow AI" };

export default async function DashboardPage() {
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();
  const data = await getDashboardData(supabase, activeOrganization.organizationId);

  const maxStageCount = Math.max(1, ...data.pipeline.map((s) => s.count));

  return (
    <div className="flex flex-col gap-5">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Empresas cadastradas" value={data.companiesCount.toLocaleString("pt-BR")} icon={Building2} />
        <KpiCard label="Leads ativos" value={data.activeLeadsCount.toLocaleString("pt-BR")} icon={Rows3} />
        <KpiCard label="Propostas enviadas" value={data.proposalsSentCount.toLocaleString("pt-BR")} icon={FileText} />
        <KpiCard
          label="Pipeline ponderado"
          value={formatBRL(data.weightedPipelineValue)}
          icon={Sparkles}
        />
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
              description="Tarefas aparecerão aqui quando leads e follow-ups forem criados (Fase 4)."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-[#2d243c]">
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
            description="O histórico de mudanças de etapa aparecerá aqui conforme leads avançarem no pipeline (Fase 4)."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-[#2d243c]">
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

      <ChartCard
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--ff-violet-glow)]" aria-hidden /> Insight da IA
          </span>
        }
        subtitle="Análises automáticas do seu funil e das empresas prospectadas"
        action={<Badge variant="outline">Fase 5</Badge>}
        className="border-[#55347a] bg-[linear-gradient(100deg,#281743,#1b1430_60%,#201332)]"
      >
        <p className="text-sm text-[var(--ff-text-secondary)]">
          O FinderFlow Copilot vai gerar insights reais a partir dos seus dados (empresas, leads e
          propostas) quando a integração com OpenAI for implementada. Nenhuma análise é inventada
          antes disso.
        </p>
      </ChartCard>
    </div>
  );
}
