"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { sendGmailMessage } from "@/lib/email/gmail-smtp-client";
import { logger } from "@/lib/logger/logger";

export interface SendOutreachEmailResult {
  success: boolean;
  message?: string;
}

/**
 * Resolve as credenciais Gmail da organização (e-mail + senha de app,
 * vindo do Vault) — nunca a conta pessoal do super admin, sempre a da
 * própria organização que está enviando.
 */
async function resolveOrgGmailCredentials(
  organizationId: string,
): Promise<{ gmailAddress: string; appPassword: string } | null> {
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
