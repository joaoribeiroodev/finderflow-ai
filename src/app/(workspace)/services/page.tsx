import type { Metadata } from "next";
import { Wrench } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { listServices } from "@/modules/services/services.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ServiceForm } from "@/components/services/service-form";
import { ServiceRow } from "@/components/services/service-row";

export const metadata: Metadata = { title: "Serviços — FinderFlow AI" };

export default async function ServicesPage() {
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const services = await listServices(supabase, activeOrganization.organizationId);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Comercial"
        title="Catálogo de serviços"
        subtitle="O que você vende. Usado nas propostas e nas sugestões da IA (Opportunity Engine) — nunca é cobrança do FinderFlow."
      />

      <Card>
        <CardHeader title="Novo serviço" />
        <ServiceForm />
      </Card>

      <Card className="p-0">
        <div className="p-5 pb-0">
          <CardHeader title={`Serviços (${services.length})`} />
        </div>
        {services.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Wrench} title="Nenhum serviço cadastrado" description="Crie o primeiro serviço acima." />
          </div>
        ) : (
          <ul>
            {services.map((service) => (
              <ServiceRow key={service.id} service={service} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
