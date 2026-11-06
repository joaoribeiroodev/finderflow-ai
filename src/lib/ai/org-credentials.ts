import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv, isOpenAiConfigured } from "@/lib/env/env.server";
import { logger } from "@/lib/logger/logger";

export interface ResolvedOpenAiCredentials {
  apiKey: string;
  model: string | null;
}

/**
 * Resolve qual chave OpenAI usar para uma organização (Fase 9 — ver
 * docs/DECISIONS.md): prioriza a chave que a própria organização
 * configurou (`organization_integration_credentials`, via Vault); se
 * não houver, cai para a chave global do ambiente (`OPENAI_API_KEY`),
 * se existir. Retorna `null` se nenhuma das duas estiver disponível —
 * quem chamar trata como "IA não configurada", igual antes da Fase 9.
 *
 * Depende de `SUPABASE_SERVICE_ROLE_KEY` para ler a chave da própria
 * organização (a função `get_org_openai_api_key` só pode ser chamada
 * por `service_role` — nunca pelo cliente comum). Sem ela configurada,
 * degrada silenciosamente para a chave global.
 */
export async function resolveOpenAiCredentialsForOrganization(
  organizationId: string,
): Promise<ResolvedOpenAiCredentials | null> {
  try {
    const admin = createAdminClient();

    const [{ data: apiKey, error: keyError }, { data: row }] = await Promise.all([
      admin.rpc("get_org_openai_api_key", { p_org: organizationId }),
      admin
        .from("organization_integration_credentials")
        .select("openai_model")
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);

    if (keyError) {
      logger.error("Falha ao resolver chave OpenAI da organização", {
        error: keyError.message,
        organizationId,
      });
    } else if (apiKey) {
      return { apiKey, model: row?.openai_model ?? null };
    }
  } catch (error) {
    logger.warn("Resolução de chave OpenAI por organização indisponível (service role não configurada?)", {
      error: (error as Error).message,
      organizationId,
    });
  }

  const env = getServerEnv();
  if (isOpenAiConfigured(env)) {
    return { apiKey: env.OPENAI_API_KEY!, model: env.OPENAI_DEFAULT_MODEL ?? null };
  }

  return null;
}
