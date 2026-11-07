import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

/**
 * Lista de supressão / oposição a contato (LGPD — Fase 10, ver
 * ETAPA-0-AUDITORIA.md seção 4: planejada no PRD original, nunca
 * implementada). Qualquer rotina futura de envio em massa (campanhas,
 * cadências, WhatsApp) é OBRIGADA a chamar `isContactSuppressed` antes
 * de contatar alguém — ver risco #2 na auditoria.
 */

export type SuppressionContactType = "email" | "phone";
export type SuppressionReason = "opt_out" | "bounce" | "complaint" | "manual";

export interface SuppressionEntry {
  id: string;
  contactType: SuppressionContactType;
  contactValue: string;
  reason: SuppressionReason;
  source: string | null;
  createdAt: string;
}

export async function listSuppressionEntries(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<SuppressionEntry[]> {
  const { data, error } = await supabase
    .from("suppression_entries")
    .select("id, contact_type, contact_value, reason, source, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar lista de supressão", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar a lista de supressão.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    contactType: row.contact_type as SuppressionContactType,
    contactValue: row.contact_value,
    reason: row.reason as SuppressionReason,
    source: row.source,
    createdAt: row.created_at,
  }));
}

/**
 * Checagem central — chamada via função SQL `is_contact_suppressed`
 * (security definer, ver migration fase10_foundations) para que a
 * normalização de e-mail/telefone seja feita uma única vez, no banco,
 * nunca reimplementada (e potencialmente divergente) em cada chamador.
 */
export async function isContactSuppressed(
  organizationId: string,
  contactType: SuppressionContactType,
  contactValue: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("is_contact_suppressed", {
    p_org: organizationId,
    p_type: contactType,
    p_value: contactValue,
  });

  if (error) {
    logger.error("Falha ao checar lista de supressão", {
      error: error.message,
      organizationId,
      contactType,
    });
    // Falha fechada: se não é possível confirmar que o contato NÃO está
    // suprimido, trata como suprimido — nunca manda mensagem quando a
    // checagem de oposição a contato falhou.
    return true;
  }

  return Boolean(data);
}
