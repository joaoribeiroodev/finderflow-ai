import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";
import { asaasBaseUrlFor } from "@/lib/contracts/asaas-charges-client";

/**
 * Resolve a chave Asaas + ambiente da organização (Vault, via
 * service_role) — nunca a chave global. Retorna `null` quando a
 * organização ainda não configurou a própria chave em Configurações →
 * Integrações.
 *
 * Extraído de `src/modules/contracts/actions.ts` (Fase 9) para ser
 * reaproveitado também pela personalização de fatura (Configurações →
 * Integrações) — ambos chamam a mesma API da Asaas com a mesma chave.
 */
export async function resolveOrgAsaasCredentials(
  organizationId: string,
): Promise<{ apiKey: string; baseUrl: string } | null> {
  try {
    const admin = createAdminClient();

    const [{ data: apiKey, error: keyError }, { data: row }] = await Promise.all([
      admin.rpc("get_org_asaas_api_key", { p_org: organizationId }),
      admin
        .from("organization_integration_credentials")
        .select("asaas_environment")
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);

    if (keyError) {
      logger.error("Falha ao resolver chave Asaas da organização", {
        error: keyError.message,
        organizationId,
      });
      return null;
    }
    if (!apiKey) return null;

    const environment = (row?.asaas_environment as "sandbox" | "production") ?? "sandbox";
    return { apiKey, baseUrl: asaasBaseUrlFor(environment) };
  } catch (error) {
    // createAdminClient() lança quando SUPABASE_SERVICE_ROLE_KEY não está
    // configurada no ambiente — mesmo degrade silencioso usado em
    // resolveOpenAiCredentialsForOrganization (src/lib/ai/org-credentials.ts):
    // trata como "organização não configurou a chave" em vez de derrubar a página.
    logger.warn("Resolução de credenciais Asaas indisponível (service role não configurada?)", {
      error: (error as Error).message,
      organizationId,
    });
    return null;
  }
}
