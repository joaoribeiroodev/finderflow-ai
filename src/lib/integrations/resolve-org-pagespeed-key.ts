import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";

/**
 * Resolve a chave de API da PageSpeed Insights configurada pela própria
 * organização (Vault — ver migration 20261108054539_module2_website_audit.sql).
 * Diferente da OpenAI, não há fallback para uma chave global do ambiente:
 * cada organização usa sua própria chave gratuita do Google Cloud (mesmo
 * princípio de Gmail/Asaas — credencial 100% por organização).
 *
 * Depende de `SUPABASE_SERVICE_ROLE_KEY` (a função `get_org_pagespeed_api_key`
 * só pode ser chamada por `service_role`). Retorna `null` se a organização
 * não configurou a chave ou se a service role não está disponível — quem
 * chamar trata como "integração não configurada".
 */
export async function resolveOrgPageSpeedApiKey(organizationId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("get_org_pagespeed_api_key", { p_org: organizationId });

    if (error) {
      logger.error("Falha ao resolver chave PageSpeed da organização", {
        error: error.message,
        organizationId,
      });
      return null;
    }

    return data ?? null;
  } catch (error) {
    logger.warn("Resolução de chave PageSpeed indisponível (service role não configurada?)", {
      error: (error as Error).message,
      organizationId,
    });
    return null;
  }
}
