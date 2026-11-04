import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { CompanyForm } from "@/components/companies/company-form";

export const metadata: Metadata = { title: "Nova empresa — FinderFlow AI" };

export default function NewCompanyPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Prospecção"
        title="Nova empresa"
        subtitle="Cadastro manual. Para importar várias de uma vez, use a importação de CSV."
      />
      <Card className="max-w-2xl">
        <CompanyForm />
      </Card>
    </div>
  );
}
