import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganizationForPage } from "@/modules/organizations/active-organization";
import { getCadenceById, listCadenceSteps } from "@/modules/cadences/cadences.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddCadenceStepForm } from "@/components/cadences/add-cadence-step-form";
import { CadenceStepList } from "@/components/cadences/cadence-step-list";
import { CadenceStatusToggle } from "@/components/cadences/cadence-status-toggle";

export const metadata: Metadata = { title: "Cadência — FinderFlow AI" };

export default async function CadenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activeOrganization = await requireActiveOrganizationForPage();
  const supabase = await createClient();

  const cadence = await getCadenceById(supabase, activeOrganization.organizationId, id);
  if (!cadence) notFound();

  const steps = await listCadenceSteps(supabase, activeOrganization.organizationId, id);
  const nextStepOrder = steps.length === 0 ? 1 : Math.max(...steps.map((s) => s.stepOrder)) + 1;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/cadences"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar para cadências
      </Link>

      <PageHeader
        eyebrow="Cadência"
        title={cadence.name}
        subtitle={cadence.description ?? undefined}
        actions={
          <>
            <Badge variant={cadence.status === "active" ? "success" : "outline"}>
              {cadence.status === "active" ? "Ativa" : "Arquivada"}
            </Badge>
            <CadenceStatusToggle cadenceId={cadence.id} status={cadence.status} />
          </>
        }
      />

      <Card>
        <CardHeader
          title="Etapas"
          subtitle="Templates escritos por você — nunca gerados por IA. Use {{contact_name}}, {{company_name}} e {{sender_name}} para personalizar."
        />
        <div className="flex flex-col gap-4">
          <CadenceStepList cadenceId={cadence.id} steps={steps} />
          <AddCadenceStepForm cadenceId={cadence.id} nextStepOrder={nextStepOrder} />
        </div>
      </Card>
    </div>
  );
}
