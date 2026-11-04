import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Propostas — FinderFlow AI" };

export default function ProposalsPage() {
  return (
    <ComingSoon
      icon={FileText}
      eyebrow="Comercial"
      title="Propostas"
      subtitle="Acompanhe orçamentos e oportunidades em negociação."
      phase={7}
      description="O catálogo de serviços e o construtor de propostas serão implementados na Fase 7, vinculados a um lead — valores do negócio do assinante, nunca misturados com a assinatura do FinderFlow."
    />
  );
}
