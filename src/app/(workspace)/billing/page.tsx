import type { Metadata } from "next";
import { CreditCard } from "lucide-react";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Assinatura — FinderFlow AI" };

export default function BillingPage() {
  return (
    <ComingSoon
      icon={CreditCard}
      eyebrow="Conta e assinatura"
      title="Planos e faturamento"
      subtitle="Gerencie sua assinatura e acompanhe os limites do seu workspace."
      phase={6}
      description="Planos, checkout recorrente hospedado e histórico de cobranças via Asaas serão implementados na Fase 6. Nenhum valor ou plano é aceito do navegador — o backend sempre calcula o preço."
    />
  );
}
