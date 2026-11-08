import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sendGmailMessage } from "@/lib/email/gmail-smtp-client";
import { resolveOrgGmailCredentials } from "@/lib/email/resolve-org-gmail-credentials";
import { logger } from "@/lib/logger/logger";
import { getCompanyById } from "@/modules/companies/companies.service";
import { getOrganizationIntegrationStatus } from "@/modules/organizations/credentials.service";
import { getOrganizationProfile } from "@/modules/organizations/profile.service";
import { resolveDefaultRecipientEmail } from "@/modules/outreach-email/outreach-email.service";
import { isContactSuppressed } from "@/modules/suppression/suppression.service";
import type { Database } from "@/types/database";

import { computeStepRunAt, decideCadenceStep, renderCadenceStepBody, renderCadenceTemplate } from "./cadence-compose";

type Supabase = SupabaseClient<Database>;

// Pequena margem de retry quando a organização não tem Gmail/texto de
// descadastro configurado no momento em que uma etapa venceria — evita
// tentar de novo a cada execução do worker (a cada ~15min) enquanto
// aguarda a organização corrigir a configuração.
const CONFIG_MISSING_RETRY_HOURS = 24;
const BATCH_SIZE = 50;

interface DueEnrollment {
  id: string;
  organization_id: string;
  cadence_id: string;
  lead_id: string;
  current_step_order: number;
}

/**
 * Processa todas as inscrições de cadência "devidas" (status active,
 * next_run_at vencido) — chamado pelo job periódico `process_cadence_steps`
 * (ver job-handlers.ts). Processa em lote limitado (`BATCH_SIZE`) por
 * execução para nunca travar o worker com uma fila gigante de uma vez;
 * o próximo tick pega o resto.
 */
export async function processDueCadenceSteps(admin: Supabase): Promise<{ processed: number }> {
  const { data: due, error } = await admin
    .from("cadence_enrollments")
    .select("id, organization_id, cadence_id, lead_id, current_step_order")
    .eq("status", "active")
    .lte("next_run_at", new Date().toISOString())
    .limit(BATCH_SIZE);

  if (error) {
    logger.error("Falha ao buscar inscrições de cadência devidas", { error: error.message });
    throw new Error(error.message);
  }

  for (const enrollment of due ?? []) {
    try {
      await processOneEnrollment(admin, enrollment as DueEnrollment);
    } catch (stepError) {
      // Uma inscrição com erro nunca trava as outras do lote — mesmo
      // princípio de `handleSendCampaignMessage` (Módulo 6).
      logger.error("Falha ao processar etapa de cadência", {
        error: (stepError as Error).message,
        enrollmentId: enrollment.id,
      });
    }
  }

  return { processed: due?.length ?? 0 };
}

async function processOneEnrollment(admin: Supabase, enrollment: DueEnrollment): Promise<void> {
  const { organization_id: organizationId, cadence_id: cadenceId, lead_id: leadId } = enrollment;

  const nextStepOrder = enrollment.current_step_order + 1;
  const { data: step, error: stepError } = await admin
    .from("cadence_steps")
    .select("id, step_order, day_offset, subject_template, body_template")
    .eq("organization_id", organizationId)
    .eq("cadence_id", cadenceId)
    .eq("step_order", nextStepOrder)
    .maybeSingle();

  if (stepError) throw new Error(stepError.message);

  if (!step) {
    // Não há próxima etapa — cadência concluída para este lead.
    await admin.from("cadence_enrollments").update({ status: "completed" }).eq("id", enrollment.id);
    return;
  }

  const { data: lead, error: leadError } = await admin
    .from("leads")
    .select("status, company_id")
    .eq("organization_id", organizationId)
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) throw new Error(leadError.message);
  if (!lead) {
    await admin
      .from("cadence_enrollments")
      .update({ status: "stopped", stopped_reason: "lead_not_found", stopped_at: new Date().toISOString() })
      .eq("id", enrollment.id);
    return;
  }

  const [company, recipientEmail, organizationProfile, integrationStatus] = await Promise.all([
    getCompanyById(admin, organizationId, lead.company_id),
    resolveDefaultRecipientEmail(admin, organizationId, lead.company_id),
    getOrganizationProfile(admin, organizationId),
    getOrganizationIntegrationStatus(admin, organizationId),
  ]);

  const suppressed = recipientEmail
    ? await isContactSuppressed(organizationId, "email", recipientEmail)
    : false;

  const decision = decideCadenceStep({
    leadStatus: lead.status as "open" | "won" | "lost",
    recipientEmail,
    isSuppressed: suppressed,
  });

  if (decision.action === "stop") {
    await admin
      .from("cadence_enrollments")
      .update({ status: "stopped", stopped_reason: decision.reason, stopped_at: new Date().toISOString() })
      .eq("id", enrollment.id);
    await admin.from("cadence_step_sends").insert({
      organization_id: organizationId,
      enrollment_id: enrollment.id,
      step_id: step.id,
      step_order: step.step_order,
      status: "skipped",
      recipient_email: recipientEmail,
      error_message: `Cadência interrompida: ${decision.reason}`,
    });
    return;
  }

  if (decision.action === "skip") {
    await admin.from("cadence_step_sends").insert({
      organization_id: organizationId,
      enrollment_id: enrollment.id,
      step_id: step.id,
      step_order: step.step_order,
      status: "skipped",
      recipient_email: recipientEmail,
      error_message: "Nenhum e-mail de destino válido para este lead.",
    });
    await advanceToNextStepOrComplete(admin, enrollment, step.step_order);
    return;
  }

  // decision.action === "send" a partir daqui.
  if (!organizationProfile.unsubscribeText?.trim() || !integrationStatus.gmailConfigured) {
    await admin.from("cadence_step_sends").insert({
      organization_id: organizationId,
      enrollment_id: enrollment.id,
      step_id: step.id,
      step_order: step.step_order,
      status: "failed",
      recipient_email: recipientEmail,
      error_message: !integrationStatus.gmailConfigured
        ? "Gmail não configurado para esta organização."
        : "Texto de descadastro não configurado para esta organização.",
    });
    // Não avança a etapa — tenta de novo depois que a organização corrigir a configuração.
    await admin
      .from("cadence_enrollments")
      .update({ next_run_at: new Date(Date.now() + CONFIG_MISSING_RETRY_HOURS * 60 * 60 * 1000).toISOString() })
      .eq("id", enrollment.id);
    return;
  }

  const contactName = await resolveContactName(admin, organizationId, lead.company_id);
  const subject = renderCadenceTemplate(step.subject_template, {
    contactName,
    companyName: company?.name ?? null,
    senderName: organizationProfile.senderName,
  });
  const body = renderCadenceStepBody(step.body_template, organizationProfile.unsubscribeText, {
    contactName,
    companyName: company?.name ?? null,
    senderName: organizationProfile.senderName,
  });

  const credentials = await resolveOrgGmailCredentials(organizationId);
  let sendError: string | null = null;
  if (!credentials) {
    sendError = "Gmail não configurado para esta organização.";
  } else {
    try {
      await sendGmailMessage({
        gmailAddress: credentials.gmailAddress,
        appPassword: credentials.appPassword,
        to: recipientEmail!,
        subject,
        text: body,
      });
    } catch (error) {
      sendError = (error as Error).message;
    }
  }

  await admin.from("cadence_step_sends").insert({
    organization_id: organizationId,
    enrollment_id: enrollment.id,
    step_id: step.id,
    step_order: step.step_order,
    status: sendError ? "failed" : "sent",
    recipient_email: recipientEmail,
    rendered_subject: subject,
    rendered_body: body,
    error_message: sendError,
  });

  if (sendError) {
    logger.error("Falha ao enviar etapa de cadência via Gmail", {
      error: sendError,
      organizationId,
      enrollmentId: enrollment.id,
    });
    await admin
      .from("cadence_enrollments")
      .update({ next_run_at: new Date(Date.now() + CONFIG_MISSING_RETRY_HOURS * 60 * 60 * 1000).toISOString() })
      .eq("id", enrollment.id);
    return;
  }

  await advanceToNextStepOrComplete(admin, enrollment, step.step_order);
}

async function advanceToNextStepOrComplete(
  admin: Supabase,
  enrollment: DueEnrollment,
  completedStepOrder: number,
): Promise<void> {
  const { data: enrollmentRow } = await admin
    .from("cadence_enrollments")
    .select("started_at")
    .eq("id", enrollment.id)
    .single();

  const { data: nextStep } = await admin
    .from("cadence_steps")
    .select("day_offset")
    .eq("organization_id", enrollment.organization_id)
    .eq("cadence_id", enrollment.cadence_id)
    .eq("step_order", completedStepOrder + 1)
    .maybeSingle();

  if (!nextStep) {
    await admin
      .from("cadence_enrollments")
      .update({ status: "completed", current_step_order: completedStepOrder })
      .eq("id", enrollment.id);
    return;
  }

  const startedAt = enrollmentRow?.started_at ? new Date(enrollmentRow.started_at) : new Date();
  const nextRunAt = computeStepRunAt(startedAt, nextStep.day_offset);

  await admin
    .from("cadence_enrollments")
    .update({ current_step_order: completedStepOrder, next_run_at: nextRunAt.toISOString() })
    .eq("id", enrollment.id);
}

async function resolveContactName(admin: Supabase, organizationId: string, companyId: string): Promise<string | null> {
  const { data } = await admin
    .from("contacts")
    .select("name")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  return data?.[0]?.name ?? null;
}
