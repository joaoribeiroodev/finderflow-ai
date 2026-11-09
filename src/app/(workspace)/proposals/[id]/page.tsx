import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { getProposalDetail } from "@/modules/proposals/proposals.service";
import { getProposalPdfSignedUrl } from "@/modules/proposals/pdf.service";
import { listActiveServices } from "@/modules/services/services.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { ProposalStatusBadge } from "@/components/proposals/proposal-status-badge";
import { ProposalStatusActions } from "@/components/proposals/proposal-status-actions";
import { ProposalItemForm } from "@/components/proposals/proposal-item-form";
import { ProposalItemRowView } from "@/components/proposals/proposal-item-row";
import { ProposalPdfButton } from "@/components/proposals/proposal-pdf-button";
import { DealCard } from "@/components/deals/deal-card";
import { OutreachEmailComposer } from "@/components/outreach/outreach-email-composer";
import {
  listOutreachEmails,
  resolveDefaultRecipientEmail,
} from "@/modules/outreach-email/outreach-email.service";
import { getOrganizationIntegrationStatus } from "@/modules/organizations/credentials.service";
import { effectiveProposalStatus, type ProposalStatus } from "@/lib/validation/proposals";
import { formatBRL, formatCalendarDate, formatRelativeDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Proposta — FinderFlow AI" };

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const [proposal, services] = await Promise.all([
    getProposalDetail(supabase, activeOrganization.organizationId, id),
    listActiveServices(supabase, activeOrganization.organizationId),
  ]);

  if (!proposal) notFound();

  const effective = effectiveProposalStatus(proposal.status as ProposalStatus, proposal.valid_until);
  const editable = proposal.status === "draft";
  const signedUrl = proposal.document_path
    ? await getProposalPdfSignedUrl(supabase, proposal.document_path)
    : null;

  const leadCompanyId = proposal.lead?.company?.id ?? null;
  const [outreachHistory, defaultRecipientEmail, integrationStatus] = await Promise.all([
    proposal.lead ? listOutreachEmails(supabase, activeOrganization.organizationId, proposal.lead.id) : Promise.resolve([]),
    leadCompanyId
      ? resolveDefaultRecipientEmail(supabase, activeOrganization.organizationId, leadCompanyId)
      : Promise.resolve(null),
    getOrganizationIntegrationStatus(supabase, activeOrganization.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/proposals"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar para propostas
      </Link>

      <PageHeader
        eyebrow="Proposta"
        title={proposal.proposal_number}
        subtitle={`Criada ${formatRelativeDateTime(proposal.created_at)}${proposal.valid_until ? ` · válida até ${formatCalendarDate(proposal.valid_until)}` : ""}.`}
        actions={
          <>
            <ProposalStatusBadge status={effective} />
            {proposal.lead ? (
              <Link href={`/leads/${proposal.lead.id}`}>
                <span className="inline-flex h-9 items-center rounded-xl border border-[var(--ff-border-subtle)] px-3 text-sm text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]">
                  Ver lead {proposal.lead.company ? `· ${proposal.lead.company.name}` : ""}
                </span>
              </Link>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader title="Itens" subtitle="Serviços e valores desta proposta — o total é recalculado automaticamente." />
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--ff-border-subtle)] text-left text-xs text-[var(--ff-text-muted)]">
              <th className="pb-2">Descrição</th>
              <th className="pb-2 text-right">Qtd.</th>
              <th className="pb-2 text-right">Preço unit.</th>
              <th className="pb-2 text-right">Total</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {proposal.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-[var(--ff-text-muted)]">
                  Nenhum item ainda.
                </td>
              </tr>
            ) : (
              proposal.items.map((item) => (
                <ProposalItemRowView key={item.id} item={item} proposalId={proposal.id} editable={editable} />
              ))
            )}
          </tbody>
        </table>
        <div className="mt-3 flex justify-end">
          <span className="ff-tabular-nums text-lg font-bold text-[var(--ff-text-primary)]">
            Total: {formatBRL(Number(proposal.total_amount))}
          </span>
        </div>
        {editable ? (
          <div className="mt-4">
            <ProposalItemForm proposalId={proposal.id} services={services} />
          </div>
        ) : (
          <p className="mt-4 text-xs text-[var(--ff-text-muted)]">
            Itens só podem ser editados enquanto a proposta está em rascunho.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Status" subtitle="Ciclo de vida: rascunho → enviada → aceita/rejeitada/expirada." />
        <ProposalStatusActions proposalId={proposal.id} currentStatus={effective} />
      </Card>

      <Card>
        <CardHeader title="PDF" subtitle="Documento gerado a partir dos itens atuais da proposta." />
        <ProposalPdfButton proposalId={proposal.id} signedUrl={signedUrl} />
      </Card>

      {proposal.lead && leadCompanyId ? (
        <OutreachEmailComposer
          leadId={proposal.lead.id}
          companyId={leadCompanyId}
          defaultRecipientEmail={defaultRecipientEmail}
          history={outreachHistory}
          gmailConfigured={integrationStatus.gmailConfigured}
        />
      ) : null}

      {proposal.status === "accepted" ? (
        <Card>
          <CardHeader title="Negócio" subtitle="Registre o resultado da negociação ligada a esta proposta." />
          <DealCard deal={proposal.deal} proposalId={proposal.id} />
        </Card>
      ) : null}
    </div>
  );
}
