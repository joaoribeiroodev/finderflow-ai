import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { getOrganizationIntegrationStatus } from "@/modules/organizations/credentials.service";
import { listCompaniesForBilling, listContractCharges } from "@/modules/contracts/contracts.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { CreateChargeForm } from "@/components/contracts/create-charge-form";
import { ChargesHistory } from "@/components/contracts/charges-history";

export const metadata: Metadata = { title: "Contratos — FinderFlow AI" };

/**
 * Fase 9 (ver docs/DECISIONS.md): gestão financeira dos clientes da
 * organização via Asaas — cobranças, boletos e links de pagamento,
 * usando a chave Asaas da própria organização (Vault, configurável em
 * Configurações → Integrações). Nunca usa uma chave global da
 * plataforma.
 */
export default async function ContractsPage() {
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const [integrationStatus, companies, charges] = await Promise.all([
    getOrganizationIntegrationStatus(supabase, activeOrganization.organizationId),
    listCompaniesForBilling(supabase, activeOrganization.organizationId),
    listContractCharges(supabase, activeOrganization.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Financeiro"
        title="Contratos"
        subtitle="Cobranças, boletos e links de pagamento para os seus clientes, via Asaas."
      />

      {!integrationStatus.asaasConfigured ? (
        <Card>
          <CardHeader
            title="Configure a Asaas da sua organização"
            subtitle="Você ainda não cadastrou uma chave de API da Asaas. Acesse Configurações → Integrações para conectar sua conta antes de criar cobranças."
          />
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Nova cobrança" subtitle="Crie um boleto, Pix ou link de pagamento para um cliente." />
        <CreateChargeForm companies={companies} />
      </Card>

      <Card>
        <CardHeader
          title={`Cobranças (${charges.total})`}
          subtitle="Histórico de cobranças criadas para os clientes desta organização."
        />
        <ChargesHistory charges={charges.items} />
      </Card>
    </div>
  );
}
