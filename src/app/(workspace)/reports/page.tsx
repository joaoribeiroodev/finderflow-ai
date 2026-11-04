import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Relatórios — FinderFlow AI" };

export default function ReportsPage() {
  return (
    <ComingSoon
      icon={BarChart3}
      eyebrow="Desempenho"
      title="Relatórios"
      subtitle="Entenda quais segmentos e serviços geram melhores resultados."
      phase={7}
      description="Conversão por origem, segmento, serviço, responsável e tempo médio de fechamento, com definições de métrica únicas e testáveis, serão implementados na Fase 7."
    />
  );
}
