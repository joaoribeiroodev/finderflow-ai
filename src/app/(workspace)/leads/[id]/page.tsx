import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { getLeadDetail } from "@/modules/leads/leads.service";
import { listPipelineStages } from "@/modules/pipeline/pipeline.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PriorityBadge } from "@/components/leads/priority-badge";
import { StagePill } from "@/components/leads/stage-pill";
import { MoveStageForm } from "@/components/leads/move-stage-form";
import { LeadDetailsForm } from "@/components/leads/lead-details-form";
import { ContactForm } from "@/components/leads/contact-form";
import { ContactItem } from "@/components/leads/contact-item";
import { InteractionForm } from "@/components/leads/interaction-form";
import { TaskForm } from "@/components/leads/task-form";
import { TaskItem } from "@/components/leads/task-item";
import { INTERACTION_TYPE_LABELS } from "@/lib/validation/interactions";
import { formatRelativeDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Lead — FinderFlow AI" };

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const [lead, stages] = await Promise.all([
    getLeadDetail(supabase, activeOrganization.organizationId, id),
    listPipelineStages(supabase, activeOrganization.organizationId),
  ]);

  if (!lead || !lead.company) notFound();

  const stageOptions = stages.map((s) => ({
    id: s.id,
    name: s.name,
    isClosed: s.is_closed,
    resultType: s.result_type,
  }));

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar para leads
      </Link>

      <PageHeader
        eyebrow="Lead"
        title={lead.company.name}
        subtitle={`Lead desde ${formatRelativeDateTime(lead.created_at)}.`}
        actions={
          <>
            {lead.stage ? <StagePill name={lead.stage.name} color={lead.stage.color} /> : null}
            <PriorityBadge priority={lead.priority} />
            {lead.status !== "open" ? (
              <Badge variant={lead.status === "won" ? "success" : "danger"}>
                {lead.status === "won" ? "Ganho" : "Perdido"}
              </Badge>
            ) : null}
            <Link href={`/companies/${lead.company.id}`}>
              <Badge variant="outline">Ver empresa</Badge>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Etapa do funil" />
          <MoveStageForm leadId={lead.id} currentStageId={lead.stage_id} stages={stageOptions} />
        </Card>

        <Card>
          <CardHeader title="Dados do lead" />
          <LeadDetailsForm
            leadId={lead.id}
            priority={lead.priority}
            estimatedValue={lead.estimated_value}
            probability={lead.probability}
            serviceInterest={lead.service_interest}
            nextContactAt={lead.next_contact_at}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Contatos" subtitle="Pessoas desta empresa" />
          {lead.contacts.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum contato cadastrado" />
          ) : (
            <ul className="mb-4 divide-y divide-[#2d243c]">
              {lead.contacts.map((contact) => (
                <ContactItem key={contact.id} contact={contact} leadId={lead.id} />
              ))}
            </ul>
          )}
          <ContactForm leadId={lead.id} companyId={lead.company.id} />
        </Card>

        <Card>
          <CardHeader title="Tarefas" />
          {lead.tasks.length === 0 ? (
            <EmptyState icon={History} title="Nenhuma tarefa ainda" />
          ) : (
            <ul className="mb-4 divide-y divide-[#2d243c]">
              {lead.tasks.map((task) => (
                <TaskItem key={task.id} task={task} leadId={lead.id} />
              ))}
            </ul>
          )}
          <TaskForm leadId={lead.id} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Timeline de interações" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
          <InteractionForm leadId={lead.id} />
          <div>
            {lead.interactions.length === 0 ? (
              <p className="text-sm text-[var(--ff-text-muted)]">Nenhuma interação registrada ainda.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {lead.interactions.map((interaction) => (
                  <li key={interaction.id} className="rounded-xl border border-[var(--ff-border-subtle)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">
                        {INTERACTION_TYPE_LABELS[interaction.type as keyof typeof INTERACTION_TYPE_LABELS] ??
                          interaction.type}
                      </Badge>
                      <span className="text-xs text-[var(--ff-text-muted)]">
                        {formatRelativeDateTime(interaction.occurred_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--ff-text-primary)]">{interaction.content_summary}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </Card>

      {lead.stageHistory.length > 0 ? (
        <Card>
          <CardHeader title="Histórico de etapas" />
          <ol className="flex flex-col gap-2 text-sm">
            {lead.stageHistory.map((entry) => {
              const fromName = stages.find((s) => s.id === entry.from_stage_id)?.name;
              const toName = stages.find((s) => s.id === entry.to_stage_id)?.name ?? "etapa removida";
              return (
                <li key={entry.id} className="flex items-center justify-between text-[var(--ff-text-secondary)]">
                  <span>
                    {fromName ? `${fromName} → ${toName}` : `Criado em ${toName}`}
                  </span>
                  <span className="text-xs text-[var(--ff-text-muted)]">
                    {formatRelativeDateTime(entry.changed_at)}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}
