import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";
import type { Json } from "@/types/database";

/**
 * Auditoria de ações administrativas e financeiras (Fase 10 — fundações,
 * ver ETAPA-0-AUDITORIA.md seção 5 risco #4: `audit_logs` já existia no
 * schema, mas só era usado para login; a maioria das ações sensíveis não
 * era auditada).
 *
 * `audit_logs` não tem RLS de escrita para `authenticated` (ver
 * supabase/migrations/20261104143307_core_schema.sql) — só o backend com
 * o cliente admin (service role) grava aqui, nunca o cliente autenticado
 * normal. Mesmo padrão de degrade silencioso usado em
 * src/lib/auth/login-security.ts: se `SUPABASE_SERVICE_ROLE_KEY` ainda
 * não estiver configurada neste ambiente, a auditoria é perdida — nunca
 * a ação que está sendo auditada é bloqueada por causa disso.
 */
export interface AuditLogInput {
  /** `null` para ações de plataforma sem organização associada (ex.: super admin). */
  organizationId: string | null;
  /** `null` quando o ator é o próprio sistema (ex.: job assíncrono). */
  actorId: string | null;
  /**
   * Ação no formato `recurso.verbo` (ex.: `organization.approve`,
   * `contract_charge.create`, `integration_credentials.set`).
   */
  action: string;
  resourceType?: string;
  resourceId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      organization_id: input.organizationId,
      actor_id: input.actorId,
      action: input.action,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      request_id: input.requestId ?? null,
      metadata: (input.metadata ?? {}) as Json,
    });

    if (error) {
      logger.error("Falha ao gravar audit log", { error: error.message, action: input.action });
    }
  } catch (error) {
    logger.warn("Audit log indisponível (service role não configurada?)", {
      error: (error as Error).message,
      action: input.action,
    });
  }
}
