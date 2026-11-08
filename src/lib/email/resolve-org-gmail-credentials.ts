import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";

export interface OrgGmailCredentials {
  gmailAddress: string;
  appPassword: string;
}

/**
 * Resolve as credenciais Gmail da organização (e-mail + senha de app,
 * vindo do Vault) — nunca a conta pessoal do super admin, sempre a da
 * própria organização que está enviando. Extraído de
 * `outreach-email/actions.ts` (Fase 5) para ser reaproveitado também
 * pelo envio de mensagens de campanha (Módulo 6) — mesmo mecanismo de
 * envio, nunca um segundo caminho paralelo.
 */
export async function resolveOrgGmailCredentials(organizationId: string): Promise<OrgGmailCredentials | null> {
  try {
    const admin = createAdminClient();

    const [{ data: row }, { data: appPassword, error: passwordError }] = await Promise.all([
      admin
        .from("organization_integration_credentials")
        .select("gmail_email")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      admin.rpc("get_org_gmail_app_password", { p_org: organizationId }),
    ]);

    if (passwordError) {
      logger.error("Falha ao resolver senha de app do Gmail da organização", {
        error: passwordError.message,
        organizationId,
      });
      return null;
    }
    if (!row?.gmail_email || !appPassword) return null;

    return { gmailAddress: row.gmail_email, appPassword };
  } catch (error) {
    // Mesmo degrade silencioso de resolveOpenAiCredentialsForOrganization —
    // createAdminClient() lança quando SUPABASE_SERVICE_ROLE_KEY está ausente.
    logger.warn("Resolução de credenciais Gmail indisponível (service role não configurada?)", {
      error: (error as Error).message,
      organizationId,
    });
    return null;
  }
}
