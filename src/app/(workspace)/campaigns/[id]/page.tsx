import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganizationForPage } from "@/modules/organizations/active-organization";
import { getCampaignById, listCampaignCompanies } from "@/modules/campaigns/campaigns.service";
import { getCampaignMessage } from "@/modules/campaigns/campaign-messages.service";
import { listCompanies } from "@/modules/companies/companies.service";
import { getOrganizationProfile } from "@/modules/organizations/profile.service";
import { getOrganizationIntegrationStatus } from "@/modules/organizations/credentials.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AddCompaniesToCampaignForm } from "@/components/campaigns/add-companies-to-campaign-form";
import { CampaignCompanyRow } from "@/components/campaigns/campaign-company-row";
import { SendApprovedCampaignMessagesButton } from "@/components/campaigns/send-approved-campaign-messages-button";

export const metadata: Metadata = { title: "Campanha — FinderFlow AI" };

const statusLabel = { selected: "Selecionada", excluded: "Excluída", contacted: "Contatada", responded: "Respondeu" };

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const activeOrganization = await requireActiveOrganizationForPage();
  const supabase = await createClient();

  const campaign = await getCampaignById(supabase, activeOrganization.organizationId, id);
  if (!campaign) notFound();

  const [campaignCompanies, organizationProfile, integrationStatus] = await Promise.all([
    listCampaignCompanies(supabase, activeOrganization.organizationId, id),
    getOrganizationProfile(supabase, activeOrganization.organizationId),
    getOrganizationIntegrationStatus(supabase, activeOrganization.organizationId),
  ]);

  const messages = await Promise.all(
    campaignCompanies.map((cc) => getCampaignMessage(supabase, activeOrganization.organizationId, cc.id)),
  );

  const alreadyAddedIds = new Set(campaignCompanies.map((cc) => cc.companyId));
  const searchResult = q
    ? await listCompanies(supabase, activeOrganization.organizationId, { search: q, page: 1 })
    : null;
  const candidateCompanies = (searchResult?.companies ?? []).filter((c) => !alreadyAddedIds.has(c.id));

  const unsubscribeConfigured = Boolean(organizationProfile.unsubscribeText?.trim());
  const approvedCount = campaignCompanies.filter((cc, i) => messages[i]?.status === "approved").length;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar para campanhas
      </Link>

      <PageHeader
        eyebrow="Campanha"
        title={campaign.name}
        subtitle={campaign.objective ?? undefined}
        actions={
          <SendApprovedCampaignMessagesButton campaignId={campaign.id} approvedCount={approvedCount} />
        }
      />

      {!unsubscribeConfigured ? (
        <Card className="border-[var(--ff-danger)]">
          <p className="text-sm text-[var(--ff-danger)]">
            Configure o texto de descadastro em{" "}
            <Link href="/settings" className="underline">
              Configurações → Perfil
            </Link>{" "}
            antes de enviar qualquer mensagem desta campanha.
          </p>
        </Card>
      ) : null}
      {!integrationStatus.gmailConfigured ? (
        <Card className="border-[var(--ff-danger)]">
          <p className="text-sm text-[var(--ff-danger)]">
            Configure sua conta Gmail em{" "}
            <Link href="/settings" className="underline">
              Configurações → Integrações
            </Link>{" "}
            antes de enviar qualquer mensagem desta campanha.
          </p>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Adicionar empresas" subtitle="Busque por nome e selecione quem entra nesta campanha." />
        <AddCompaniesToCampaignForm campaignId={campaign.id} query={q ?? ""} candidates={candidateCompanies} />
      </Card>

      <Card>
        <CardHeader
          title="Empresas da campanha"
          subtitle={`${campaignCompanies.length} empresa${campaignCompanies.length === 1 ? "" : "s"}.`}
        />

        {campaignCompanies.length === 0 ? (
          <EmptyState icon={Users} title="Nenhuma empresa adicionada ainda" />
        ) : (
          <ul className="flex flex-col gap-3">
            {campaignCompanies.map((cc, i) => (
              <CampaignCompanyRow
                key={cc.id}
                campaignId={campaign.id}
                campaignCompany={cc}
                message={messages[i]}
                statusLabel={statusLabel}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
