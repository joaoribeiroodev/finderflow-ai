"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { sendGmailMessage } from "@/lib/email/gmail-smtp-client";
import { resolveOrgGmailCredentials } from "@/lib/email/resolve-org-gmail-credentials";
import { isContactSuppressed } from "@/modules/suppression/suppression.service";
import { logger } from "@/lib/logger/logger";

export interface SendOutreachEmailResult {
  success: boolean;
  message?: string;
}

export async function sendOutreachEmailAction(
  _prev: SendOutreachEmailResult,
  formData: FormData,
): Promise<SendOutreachEmailResult> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const companyId = String(formData.get("companyId") ?? "").trim();
  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const sourceAnalysisId = String(formData.get("sourceAnalysisId") ?? "").trim() || null;

  if (!leadId || !companyId) return { success: false, message: "Lead inválido." };
  if (!recipientEmail || !recipientEmail.includes("@")) {
    return { success: false, message: "Informe um e-mail de destino válido." };
  }
  if (!subject) return { success: false, message: "Informe um assunto." };
  if (!body) return { success: false, message: "O corpo do e-mail não pode ficar vazio." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    throw error;
  }

  const credentials = await resolveOrgGmailCredentials(organizationId);
  if (!credentials) {
    return {
      success: false,
      message:
        "Configure sua conta Gmail em Configurações → Integrações antes de enviar e-mails de prospecção.",
    };
  }

  // Risco #2 da auditoria (ETAPA-0-AUDITORIA.md §5): nenhuma rotina de
  // contato pode ignorar a lista de supressão/LGPD (Fase 10). Esta
  // checagem já existia como lacuna aqui (envio manual, pré-Módulo 6) —
  // corrigida agora como parte da mesma rotina de reforço que o Módulo 6
  // introduz, sem mudar o comportamento esperado para contatos não
  // suprimidos.
  if (await isContactSuppressed(organizationId, "email", recipientEmail)) {
    return {
      success: false,
      message: "Este e-mail está na lista de supressão desta organização — envio bloqueado.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let sendError: string | null = null;
  try {
    await sendGmailMessage({
      gmailAddress: credentials.gmailAddress,
      appPassword: credentials.appPassword,
      to: recipientEmail,
      subject,
      text: body,
    });
  } catch (error) {
    sendError = (error as Error).message;
    logger.error("Falha ao enviar e-mail de prospecção via Gmail", {
      error: sendError,
      organizationId,
      leadId,
    });
  }

  const { error: insertError } = await supabase.from("outreach_emails").insert({
    organization_id: organizationId,
    lead_id: leadId,
    company_id: companyId,
    source_analysis_id: sourceAnalysisId,
    recipient_email: recipientEmail,
    subject,
    body,
    status: sendError ? "failed" : "sent",
    error_message: sendError,
    sent_by: user?.id ?? null,
  });

  if (insertError) {
    logger.error("Falha ao registrar envio de e-mail de prospecção", {
      error: insertError.message,
      organizationId,
      leadId,
    });
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/proposals");

  if (sendError) {
    return { success: false, message: `Falha ao enviar: ${sendError}` };
  }
  return { success: true, message: `E-mail enviado para ${recipientEmail}.` };
}
