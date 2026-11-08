import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export interface OrganizationIntegrationStatus {
  asaasConfigured: boolean;
  asaasEnvironment: "sandbox" | "production";
  openaiConfigured: boolean;
  openaiModel: string | null;
  gmailConfigured: boolean;
  gmailEmail: string | null;
  pagespeedConfigured: boolean;
}

const DEFAULT_STATUS: OrganizationIntegrationStatus = {
  asaasConfigured: false,
  asaasEnvironment: "sandbox",
  openaiConfigured: false,
  openaiModel: null,
  gmailConfigured: false,
  gmailEmail: null,
  pagespeedConfigured: false,
};

/**
 * Lê só metadados (nunca o valor da chave — essa nunca sai do Vault
 * exceto via `get_org_*_api_key`, restrita a service_role) sobre as
 * credenciais Asaas/OpenAI configuradas pela própria organização
 * (Fase 9 — ver docs/DECISIONS.md).
 */
export async function getOrganizationIntegrationStatus(
  supabase: Supabase,
  organizationId: string,
): Promise<OrganizationIntegrationStatus> {
  const { data, error } = await supabase
    .from("organization_integration_credentials")
    .select(
      "asaas_environment, asaas_configured_at, openai_model, openai_configured_at, gmail_email, gmail_configured_at, pagespeed_configured_at",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao carregar status de integrações da organização", {
      error: error.message,
      organizationId,
    });
    return DEFAULT_STATUS;
  }

  if (!data) return DEFAULT_STATUS;

  return {
    asaasConfigured: Boolean(data.asaas_configured_at),
    asaasEnvironment: (data.asaas_environment as "sandbox" | "production") ?? "sandbox",
    openaiConfigured: Boolean(data.openai_configured_at),
    openaiModel: data.openai_model,
    gmailConfigured: Boolean(data.gmail_configured_at),
    gmailEmail: data.gmail_email,
    pagespeedConfigured: Boolean(data.pagespeed_configured_at),
  };
}
