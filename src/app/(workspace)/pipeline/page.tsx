import type { Metadata } from "next";
import { KanbanSquare } from "lucide-react";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Pipeline — FinderFlow AI" };

export default function PipelinePage() {
  return (
    <ComingSoon
      icon={KanbanSquare}
      eyebrow="Acompanhe cada oportunidade"
      title="Pipeline comercial"
      subtitle="Organize seus leads e acompanhe a evolução até o fechamento."
      phase={4}
      description="O Kanban por etapa configurável, com arrastar e soltar acessível por teclado, será implementado na Fase 4 (CRM). O resumo das etapas já aparece na Visão geral."
    />
  );
}
