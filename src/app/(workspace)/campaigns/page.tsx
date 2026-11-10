import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganizationForPage } from "@/modules/organizations/active-organization";
import { listCampaigns } from "@/modules/campaigns/campaigns.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeDateTime } from "@/lib/utils/format";
import { NewCampaignForm } from "@/components/campaigns/new-campaign-form";

export const metadata: Metadata = { title: "Campanhas — FinderFlow AI" };

const statusVariant = {
  draft: "outline",
  active: "success",
  paused: "warning",
  completed: "default",
} as const;

const statusLabel = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
} as const;

export default async function CampaignsPage() {
  const activeOrganization = await requireActiveOrganizationForPage();
  const supabase = await createClient();

  const campaigns = await listCampaigns(supabase, activeOrganization.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção"
        title="Campanhas"
        subtitle="Selecione um grupo de empresas, gere e-mails personalizados por IA, revise e aprove antes de enviar."
      />

      <Card>
        <CardHeader title="Nova campanha" />
        <NewCampaignForm />
      </Card>

      <Card>
        <CardHeader
          title="Campanhas"
          subtitle={`${campaigns.length} campanha${campaigns.length === 1 ? "" : "s"}.`}
        />

        {campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="Nenhuma campanha ainda" description="Crie a primeira acima." />
        ) : (
          <ul className="flex flex-col gap-2">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ff-border-subtle)] p-3 hover:border-[var(--ff-purple-500)]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--ff-text-primary)]">{campaign.name}</span>
                      <Badge variant={statusVariant[campaign.status]}>{statusLabel[campaign.status]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--ff-text-muted)]">
                      {campaign.companyCount} empresa{campaign.companyCount === 1 ? "" : "s"} ·{" "}
                      {campaign.contactedCount} contatada{campaign.contactedCount === 1 ? "" : "s"} ·{" "}
                      {campaign.respondedCount} respondeu{campaign.respondedCount === 1 ? "" : "ram"} · criada{" "}
                      {formatRelativeDateTime(campaign.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
