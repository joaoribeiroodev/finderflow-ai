import type { Metadata } from "next";
import Link from "next/link";
import { Rows3 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { listLeads } from "@/modules/leads/leads.service";
import { listPipelineStages } from "@/modules/pipeline/pipeline.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PriorityBadge } from "@/components/leads/priority-badge";
import { StagePill } from "@/components/leads/stage-pill";
import { formatBRL, formatRelativeDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Leads — FinderFlow AI" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stageId?: string; priority?: string; page?: string }>;
}) {
  const params = await searchParams;
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const page = Number(params.page ?? "1") || 1;
  const [{ leads, total, pageSize }, stages] = await Promise.all([
    listLeads(supabase, activeOrganization.organizationId, {
      search: params.q,
      stageId: params.stageId,
      priority: params.priority,
      page,
    }),
    listPipelineStages(supabase, activeOrganization.organizationId),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(params.q || params.stageId || params.priority);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Relacionamento comercial"
        title="Leads"
        subtitle={`${total.toLocaleString("pt-BR")} lead${total === 1 ? "" : "s"} em aberto nesta organização.`}
        actions={
          <Link href="/pipeline">
            <Button variant="secondary" size="sm">
              Ver pipeline (Kanban)
            </Button>
          </Link>
        }
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3" action="/leads">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label htmlFor="q" className="text-sm font-medium text-[var(--ff-text-secondary)]">
              Buscar por empresa
            </label>
            <input
              id="q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Nome da empresa"
              className="h-11 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 text-[var(--ff-text-primary)] outline-none placeholder:text-[var(--ff-text-muted)] focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
            />
          </div>
          <div className="flex min-w-[180px] flex-col gap-1.5">
            <label htmlFor="stageId" className="text-sm font-medium text-[var(--ff-text-secondary)]">
              Etapa
            </label>
            <select
              id="stageId"
              name="stageId"
              defaultValue={params.stageId ?? ""}
              className="h-11 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 text-[var(--ff-text-primary)] outline-none focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
            >
              <option value="">Todas</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[160px] flex-col gap-1.5">
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
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </div>
          <Button type="submit" variant="secondary" size="md">
            Filtrar
          </Button>
        </form>
      </Card>

      {leads.length === 0 ? (
        <EmptyState
          icon={Rows3}
          title={hasFilters ? "Nenhum lead encontrado" : "Nenhum lead ainda"}
          description={
            hasFilters
              ? "Ajuste a busca ou os filtros para ver outros leads."
              : "Converta uma empresa cadastrada em lead para começar a trabalhar o pipeline."
          }
          action={
            !hasFilters ? (
              <Link href="/companies">
                <Button size="sm">Ver empresas</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--ff-border-subtle)] text-xs text-[var(--ff-text-muted)] uppercase">
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Etapa</th>
                <th className="px-5 py-3 font-medium">Prioridade</th>
                <th className="px-5 py-3 font-medium">Valor estimado</th>
                <th className="px-5 py-3 font-medium">Próximo contato</th>
                <th className="px-5 py-3 font-medium">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ff-border-subtle)]">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-[var(--ff-bg-elevated)]/60">
                  <td className="px-5 py-3">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-[var(--ff-text-primary)] hover:text-[var(--ff-violet-glow)]"
                    >
                      {lead.company?.name ?? "—"}
                    </Link>
                    {lead.company?.category ? (
                      <p className="text-xs text-[var(--ff-text-muted)]">{lead.company.category}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-3">
                    {lead.stage ? <StagePill name={lead.stage.name} color={lead.stage.color} /> : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <PriorityBadge priority={lead.priority} />
                  </td>
                  <td className="px-5 py-3 text-[var(--ff-text-secondary)]">
                    {lead.estimated_value != null ? formatBRL(lead.estimated_value) : "—"}
                  </td>
                  <td className="px-5 py-3 text-[var(--ff-text-secondary)]">
                    {lead.next_contact_at ? formatRelativeDateTime(lead.next_contact_at) : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--ff-text-muted)]">
                    {formatRelativeDateTime(lead.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{
                pathname: "/leads",
                query: {
                  ...(params.q ? { q: params.q } : {}),
                  ...(params.stageId ? { stageId: params.stageId } : {}),
                  ...(params.priority ? { priority: params.priority } : {}),
                  page: p,
                },
              }}
              className={`flex size-9 items-center justify-center rounded-lg border ${
                p === page
                  ? "border-[var(--ff-purple-500)] bg-[var(--ff-purple-600)] text-white"
                  : "border-[var(--ff-border-subtle)] text-[var(--ff-text-secondary)] hover:border-[var(--ff-purple-500)]"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
