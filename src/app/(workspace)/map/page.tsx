import type { Metadata } from "next";
import { Map as MapIcon } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { listMapCompanies, countPendingGeocodes } from "@/modules/map/map.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MapLoader } from "@/components/map/map-loader";

export const metadata: Metadata = { title: "Mapa — FinderFlow AI" };

export default async function MapPage() {
  const { organizationId } = await requireActiveOrganization();
  const supabase = await createClient();

  const [{ points, stages }, pendingCount] = await Promise.all([
    listMapCompanies(supabase, organizationId),
    countPendingGeocodes(supabase, organizationId),
  ]);

  const hasAnyCompany = points.length > 0 || pendingCount > 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Visualização geográfica"
        title="Mapa"
        subtitle="Todas as empresas da organização, coloridas pela etapa atual do pipeline."
      />

      <Card>
        {hasAnyCompany ? (
          <MapLoader initialPoints={points} stages={stages} initialPendingCount={pendingCount} />
        ) : (
          <EmptyState
            icon={MapIcon}
            title="Nenhuma empresa para mostrar ainda"
            description="Cadastre empresas em Prospecção, manualmente ou por CSV — elas aparecem aqui automaticamente, coloridas pela etapa do pipeline."
          />
        )}
      </Card>
    </div>
  );
}
