import type { Metadata } from "next";
import { KanbanSquare } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { listPipelineStages } from "@/modules/pipeline/pipeline.service";
import { listLeadsForKanban } from "@/modules/leads/leads.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KanbanCard } from "@/components/pipeline/kanban-card";
import { StageCreateForm } from "@/components/pipeline/stage-create-form";
import { StageRow } from "@/components/pipeline/stage-row";

export const metadata: Metadata = { title: "Pipeline — FinderFlow AI" };

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ stageError?: string }>;
}) {
  const { stageError } = await searchParams;
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const [stages, leads] = await Promise.all([
    listPipelineStages(supabase, activeOrganization.organizationId),
    listLeadsForKanban(supabase, activeOrganization.organizationId),
  ]);

  const stageOptions = stages.map((s) => ({ id: s.id, name: s.name }));
  const leadsByStage = new Map<string, typeof leads>();
  for (const stage of stages) leadsByStage.set(stage.id, []);
  for (const lead of leads) leadsByStage.get(lead.stage_id)?.push(lead);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Acompanhe cada oportunidade"
        title="Pipeline comercial"
        subtitle="Mova um lead de etapa pelo seletor em cada card — funciona com teclado e sem depender de arrastar-e-soltar."
      />

      {stageError ? (
        <p role="alert" className="rounded-xl border border-[#713047] bg-[#421c2a]/40 px-4 py-3 text-sm text-[var(--ff-danger)]">
          {stageError}
        </p>
      ) : null}

      {stages.length === 0 ? (
        <EmptyState icon={KanbanSquare} title="Nenhuma etapa configurada" />
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto pb-3">
          {stages.map((stage) => {
            const stageLeads = leadsByStage.get(stage.id) ?? [];
            return (
              <div key={stage.id} className="flex w-64 flex-none flex-col gap-3 first:w-80 last:w-56">
                <div className="flex items-center gap-2 px-1">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden />
                  <h2 className="font-semibold text-[var(--ff-text-primary)]">{stage.name}</h2>
                  <span className="text-xs text-[var(--ff-text-muted)]">{stageLeads.length}</span>
                </div>
                <div className="min-h-24 flex flex-col gap-2.5 border-t-2 border-[var(--ff-brass)] bg-[var(--ff-bg-elevated)]/55 p-2.5">
                  {stageLeads.length === 0 ? (
                    <p className="px-1 text-xs text-[var(--ff-text-muted)]">Nenhum lead nesta etapa.</p>
                  ) : (
                    stageLeads.map((lead) => <KanbanCard key={lead.id} lead={lead} stages={stageOptions} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader title="Gerenciar etapas do funil" subtitle="Crie, renomeie, recolorize, reordene ou exclua etapas" />
        <div className="mb-4">
          <StageCreateForm />
        </div>
        {stages.length > 0 ? (
          <ul className="rounded-xl border border-[var(--ff-border-subtle)]">
            {stages.map((stage, index) => (
              <StageRow
                key={stage.id}
                stage={stage}
                isFirst={index === 0}
                isLast={index === stages.length - 1}
                leadCount={(leadsByStage.get(stage.id) ?? []).length}
              />
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
