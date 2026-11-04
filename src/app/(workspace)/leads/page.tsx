import type { Metadata } from "next";
import { Rows3 } from "lucide-react";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Leads — FinderFlow AI" };

export default function LeadsPage() {
  return (
    <ComingSoon
      icon={Rows3}
      eyebrow="Relacionamento comercial"
      title="Leads"
      subtitle="Sua carteira de oportunidades em um só lugar."
      phase={4}
      description="Lista, filtros, busca, contatos, timeline de interações, tarefas e prioridade serão implementados na Fase 4 (CRM)."
    />
  );
}
