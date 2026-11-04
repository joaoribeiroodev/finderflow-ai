import type { Metadata } from "next";
import { Search } from "lucide-react";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Prospecção — FinderFlow AI" };

export default function ProspectingPage() {
  return (
    <ComingSoon
      icon={Search}
      eyebrow="Encontre novas oportunidades"
      title="Central de prospecção"
      subtitle="Descubra empresas por segmento, localização e presença digital."
      phase={3}
      description="Cadastro manual, importação por CSV e integração com provedores de dados de empresas serão implementados na Fase 3."
    />
  );
}
