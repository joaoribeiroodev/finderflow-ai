import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProspectingSearchForm } from "@/components/prospecting/search-form";

export const metadata: Metadata = { title: "Prospecção — FinderFlow AI" };

export default function ProspectingPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Encontre novas oportunidades"
        title="Central de prospecção"
        subtitle="Busque empresas por segmento e localização, ou adicione empresas manualmente/via CSV."
        actions={
          <>
            <Link href="/companies/import">
              <Button variant="secondary" size="sm">
                <Upload className="mr-2 size-4" aria-hidden /> Importar CSV
              </Button>
            </Link>
            <Link href="/companies/new">
              <Button size="sm">
                <Plus className="mr-2 size-4" aria-hidden /> Nova empresa
              </Button>
            </Link>
          </>
        }
      />

      <Card>
        <ProspectingSearchForm />
      </Card>
    </div>
  );
}
