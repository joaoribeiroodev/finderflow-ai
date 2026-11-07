import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { getReportsData, resolveReportPeriod, type ConversionBreakdown } from "@/modules/reports/reports.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatBRL } from "@/lib/utils/format";
import { BarChart3, Clock, Percent, Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Relatórios — FinderFlow AI" };

function ConversionTable({ title, rows }: { title: string; rows: ConversionBreakdown[] }) {
  return (
    <Card>
      <CardHeader title={title} />
      {rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="Sem negociações encerradas no período" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--ff-border-subtle)] text-left text-xs text-[var(--ff-text-muted)]">
              <th className="pb-2">Grupo</th>
              <th className="pb-2 text-right">Ganhos</th>
              <th className="pb-2 text-right">Perdidos</th>
              <th className="pb-2 text-right">Conversão</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-[var(--ff-border-subtle)] last:border-b-0">
                <td className="py-2 text-[var(--ff-text-primary)]">{row.label}</td>
                <td className="ff-tabular-nums py-2 text-right text-[var(--ff-success)]">{row.won}</td>
                <td className="ff-tabular-nums py-2 text-right text-[var(--ff-danger)]">{row.lost}</td>
                <td className="ff-tabular-nums py-2 text-right font-medium text-[var(--ff-text-primary)]">
                  {row.conversionRate !== null ? `${(row.conversionRate * 100).toFixed(0)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const period = resolveReportPeriod(from, to);
  const data = await getReportsData(supabase, activeOrganization.organizationId, period);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Desempenho"
        title="Relatórios"
        subtitle={`Período analisado: ${period.label}. Conversão = negócios ganhos ÷ (ganhos + perdidos) encerrados no período.`}
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3">
          <Field label="De" name="from" type="date" defaultValue={period.start.toISOString().slice(0, 10)} />
          <Field label="Até" name="to" type="date" defaultValue={period.end.toISOString().slice(0, 10)} />
          <Button type="submit" variant="secondary" size="sm">
            Aplicar período
          </Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Ticket médio (ganhos)"
          value={data.avgTicket !== null ? formatBRL(data.avgTicket) : "—"}
          icon={Wallet}
        />
        <KpiCard
          label="Ciclo médio de fechamento"
          value={data.avgCycleTimeDays !== null ? `${data.avgCycleTimeDays.toFixed(1)} dias` : "—"}
          icon={Clock}
        />
        <KpiCard
          label="Consultas de IA no período"
          value={data.aiUsage.reduce((s, u) => s + u.count, 0).toLocaleString("pt-BR")}
          icon={Percent}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ConversionTable title="Conversão por segmento" rows={data.conversionBySegment} />
        <ConversionTable title="Conversão por origem" rows={data.conversionByOrigin} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ConversionTable title="Conversão por responsável" rows={data.conversionByResponsible} />
        <ConversionTable title="Conversão por serviço" rows={data.conversionByService} />
      </div>

      <ConversionTable title="Etapas presentes em negociações encerradas" rows={data.conversionByStage} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Motivos de perda" subtitle="Leads perdidos no período, por motivo registrado" />
          {data.lossReasons.length === 0 ? (
            <EmptyState icon={BarChart3} title="Nenhum lead perdido no período" />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--ff-border-subtle)]">
              {data.lossReasons.map((r) => (
                <li key={r.reason} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-[var(--ff-text-primary)]">{r.reason}</span>
                  <span className="ff-tabular-nums text-[var(--ff-text-secondary)]">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Consumo de IA" subtitle="Chamadas por operação no período" />
          {data.aiUsage.length === 0 ? (
            <EmptyState icon={BarChart3} title="Nenhuma chamada de IA no período" />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--ff-border-subtle)]">
              {data.aiUsage.map((u) => (
                <li key={u.operation} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-[var(--ff-text-primary)]">{u.operation}</span>
                  <span className="ff-tabular-nums text-[var(--ff-text-secondary)]">
                    {u.count} chamada{u.count === 1 ? "" : "s"} · US$ {u.estimatedCostUsd.toFixed(4)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
