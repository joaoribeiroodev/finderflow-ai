import type { Metadata } from "next";
import { Receipt } from "lucide-react";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Contratos — FinderFlow AI" };

/**
 * Fase 9 (ver docs/DECISIONS.md): gestão financeira dos clientes de cada
 * organização via Asaas — cobranças, boletos e links de pagamento,
 * usando a chave Asaas da própria organização (configurável em
 * Configurações → Integrações). A base já está pronta: credenciais por
 * organização (Vault), `getOrgAsaasApiKey` server-side; falta a UI de
 * criar cobrança/cliente/link e o histórico de pagamentos aqui.
 */
export default function ContractsPage() {
  return (
    <ComingSoon
      icon={Receipt}
      eyebrow="Financeiro"
      title="Contratos"
      subtitle="Cobranças, boletos e links de pagamento para os seus clientes, via Asaas."
      phase={9}
      description="Configure sua chave Asaas em Configurações → Integrações. A tela de criação de cobranças e o histórico de pagamentos chegam na sequência desta fase."
    />
  );
}
