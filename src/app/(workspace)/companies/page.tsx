import type { Metadata } from "next";
import { Building2 } from "lucide-react";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Empresas — FinderFlow AI" };

export default function CompaniesPage() {
  return (
    <ComingSoon
      icon={Building2}
      eyebrow="Base de empresas"
      title="Empresas"
      subtitle="Empresas descobertas, importadas ou cadastradas no workspace."
      phase={3}
      description="A listagem, o perfil empresarial e a conversão explícita para lead (com verificação de duplicidade) serão implementados na Fase 3."
    />
  );
}
