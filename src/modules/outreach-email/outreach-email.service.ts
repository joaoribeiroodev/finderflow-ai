import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export interface OutreachEmailRow {
  id: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
  errorMessage: string | null;
  createdAt: string;
}

export async function listOutreachEmails(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<OutreachEmailRow[]> {
  const { data, error } = await supabase
    .from("outreach_emails")
    .select("id, recipient_email, subject, body, status, error_message, created_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar e-mails de prospecção enviados", {
      error: error.message,
      organizationId,
      leadId,
    });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    body: row.body,
    status: row.status as "sent" | "failed",
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

/**
 * Resolve o e-mail de destino padrão para um lead: o primeiro contato
 * cadastrado com e-mail, senão o e-mail geral da empresa. `null` quando
 * nenhum dos dois existe — a UI então exige que o usuário digite um
 * destinatário manualmente antes de enviar.
 */
export async function resolveDefaultRecipientEmail(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<string | null> {
  const [{ data: contacts }, { data: company }] = await Promise.all([
    supabase
      .from("contacts")
      .select("email")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .not("email", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("companies").select("email").eq("organization_id", organizationId).eq("id", companyId).maybeSingle(),
  ]);

  return contacts?.[0]?.email ?? company?.email ?? null;
}
