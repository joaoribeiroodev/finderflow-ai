import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { listProposals } from "@/modules/proposals/proposals.service";
import { listLeadsForSelect } from "@/modules/leads/leads.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProposalCreateForm } from "@/components/proposals/proposal-create-form";
import { ProposalStatusBadge } from "@/components/proposals/proposal-status-badge";
import { effectiveProposalStatus, PROPOSAL_STATUSES, type ProposalStatus } from "@/lib/validation/proposals";
import { formatBRL, formatCalendarDate, formatRelativeDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Propostas — FinderFlow AI" };

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; leadId?: string }>;
}) {
  const { status, leadId } = await searchParams;
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const statusFilter = PROPOSAL_STATUSES.includes(status as ProposalStatus) ? (status as ProposalStatus) : undefined;

  const [{ proposals }, leads] = await Promise.all([
    listProposals(supabase, activeOrganization.organizationId, { status: statusFilter, leadId }),
    listLeadsForSelect(supabase, activeOrganization.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Comercial"
        title="Propostas"
        subtitle="Orçamentos vinculados a um lead — valores do negócio do assinante, nunca misturados com a assinatura do FinderFlow."
      />

      <Card>
        <CardHeader title="Nova proposta" />
        <ProposalCreateForm leads={leads} defaultLeadId={leadId} />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/proposals"
          className={`rounded-full px-3 py-1 text-xs ${!statusFilter ? "bg-[var(--ff-purple-600)] text-white" : "border border-[var(--ff-border-subtle)] text-[var(--ff-text-secondary)]"}`}
        >
          Todas
        </Link>
        {PROPOSAL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/proposals?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs ${statusFilter === s ? "bg-[var(--ff-purple-600)] text-white" : "border border-[var(--ff-border-subtle)] text-[var(--ff-text-secondary)]"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      <Card className="p-0">
        {proposals.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={FileText} title="Nenhuma proposta encontrada" description="Crie a primeira proposta acima." />
          </div>
        ) : (
          <ul>
            {proposals.map((proposal) => {
              const effective = effectiveProposalStatus(
                proposal.status as ProposalStatus,
                proposal.valid_until,
              );
              return (
                <li key={proposal.id} className="border-b border-[var(--ff-border-subtle)] last:border-b-0">
                  <Link
                    href={`/proposals/${proposal.id}`}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-[var(--ff-bg-elevated)]/30"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-[var(--ff-text-primary)]">
                        {proposal.proposal_number} · {proposal.lead?.company?.name ?? "Lead removido"}
                      </span>
                      <span className="text-xs text-[var(--ff-text-muted)]">
                        Criada {formatRelativeDateTime(proposal.created_at)}
                        {proposal.valid_until ? ` · válida até ${formatCalendarDate(proposal.valid_until)}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="ff-tabular-nums font-semibold text-[var(--ff-text-primary)]">
                        {formatBRL(Number(proposal.total_amount))}
                      </span>
                      <ProposalStatusBadge status={effective} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
