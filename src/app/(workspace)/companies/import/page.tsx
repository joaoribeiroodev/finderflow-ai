import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ImportWizard } from "@/components/companies/import-wizard";

export const metadata: Metadata = { title: "Importar empresas — FinderFlow AI" };

export default function ImportCompaniesPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Prospecção"
        title="Importar empresas via CSV"
        subtitle="Upload → mapeamento de colunas → preview e validação → confirmação. Duplicatas (mesmo CNPJ ou site) nunca são mescladas automaticamente."
      />
      <Card className="max-w-3xl">
        <ImportWizard />
      </Card>
    </div>
  );
}
