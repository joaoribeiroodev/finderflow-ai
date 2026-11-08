import type { Metadata } from "next";
import Link from "next/link";
import { Repeat } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { listCadences } from "@/modules/cadences/cadences.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NewCadenceForm } from "@/components/cadences/new-cadence-form";

export const metadata: Metadata = { title: "Cadências — FinderFlow AI" };

export default async function CadencesPage() {
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const cadences = await listCadences(supabase, activeOrganization.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Prospecção"
        title="Cadências"
        subtitle="Sequências de e-mail multi-etapa, com templates escritos por você, enviadas automaticamente até o lead responder ou fechar."
      />

      <Card>
        <CardHeader title="Nova cadência" />
        <NewCadenceForm />
      </Card>

      <Card>
        <CardHeader title="Cadências" subtitle={`${cadences.length} cadência${cadences.length === 1 ? "" : "s"}.`} />

        {cadences.length === 0 ? (
          <EmptyState icon={Repeat} title="Nenhuma cadência ainda" description="Crie a primeira acima." />
        ) : (
          <ul className="flex flex-col gap-2">
            {cadences.map((cadence) => (
              <li key={cadence.id}>
                <Link
                  href={`/cadences/${cadence.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ff-border-subtle)] p-3 hover:border-[var(--ff-purple-500)]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--ff-text-primary)]">{cadence.name}</span>
                      <Badge variant={cadence.status === "active" ? "success" : "outline"}>
                        {cadence.status === "active" ? "Ativa" : "Arquivada"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--ff-text-muted)]">
                      {cadence.stepCount} etapa{cadence.stepCount === 1 ? "" : "s"} ·{" "}
                      {cadence.activeEnrollmentCount} lead{cadence.activeEnrollmentCount === 1 ? "" : "s"} em andamento
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
