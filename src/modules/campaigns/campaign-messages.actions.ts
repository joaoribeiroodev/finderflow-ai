"use server";

import { revalidatePath } from "next/cache";

import { AIProviderNotConfiguredError } from "@/lib/ai/provider";
import { AIQuotaExceededError } from "@/lib/ai/quota";
import { logAudit } from "@/lib/audit/audit-log";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { createClient } from "@/lib/supabase/server";
import type { CampaignMessageDraft } from "@/lib/ai/schemas";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { enqueueJob } from "@/lib/jobs/queue";

import {
  approveCampaignMessage,
  CampaignCompanyNotFoundError,
  CampaignNotFoundError,
  generateCampaignMessage,
  saveCampaignMessageDraft,
  sendCampaignMessage,
} from "./campaign-messages.service";
import { listCampaignCompanies } from "./campaigns.service";

export interface CampaignMessageActionResult {
  success: boolean;
  message?: string;
  data?: CampaignMessageDraft | null;
  notConfigured?: boolean;
}

function mapKnownError(error: unknown): { message: string; notConfigured?: boolean } {
  if (error instanceof AIProviderNotConfiguredError) return { message: error.message, notConfigured: true };
  if (
    error instanceof AIQuotaExceededError ||
    error instanceof PermissionError ||
    error instanceof CampaignNotFoundError ||
    error instanceof CampaignCompanyNotFoundError
  ) {
    return { message: error.message };
  }
  return { message: error instanceof Error ? error.message : "Falha inesperada." };
}

export async function generateCampaignMessageAction(
  _prev: CampaignMessageActionResult,
  formData: FormData,
): Promise<CampaignMessageActionResult> {
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const campaignCompanyId = String(formData.get("campaignCompanyId") ?? "").trim();
  if (!campaignId || !campaignCompanyId) return { success: false, message: "Dados inválidos." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const result = await generateCampaignMessage(supabase, organizationId, campaignCompanyId, user?.id ?? null);
    revalidatePath(`/campaigns/${campaignId}`);
    return {
      success: result.status === "completed",
      data: result.data,
      message: result.errorMessage,
    };
  } catch (error) {
    return { success: false, ...mapKnownError(error) };
  }
}

export async function saveCampaignMessageDraftAction(
  _prev: CampaignMessageActionResult,
  formData: FormData,
): Promise<CampaignMessageActionResult> {
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const campaignCompanyId = String(formData.get("campaignCompanyId") ?? "").trim();
  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!campaignId || !campaignCompanyId) return { success: false, message: "Dados inválidos." };
  if (!recipientEmail || !recipientEmail.includes("@")) {
    return { success: false, message: "Informe um e-mail de destino válido." };
  }
  if (!subject) return { success: false, message: "Informe um assunto." };
  if (!body) return { success: false, message: "O corpo do e-mail não pode ficar vazio." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await saveCampaignMessageDraft(
      supabase,
      organizationId,
      campaignCompanyId,
      { recipientEmail, subject, body },
      user?.id ?? null,
    );
  } catch (error) {
    return { success: false, ...mapKnownError(error) };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true, message: "Rascunho salvo." };
}

export async function approveCampaignMessageAction(
  _prev: CampaignMessageActionResult,
  formData: FormData,
): Promise<CampaignMessageActionResult> {
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const campaignCompanyId = String(formData.get("campaignCompanyId") ?? "").trim();
  if (!campaignId || !campaignCompanyId) return { success: false, message: "Dados inválidos." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await approveCampaignMessage(supabase, organizationId, campaignCompanyId, user?.id ?? null);

    await logAudit({
      organizationId,
      actorId: user?.id ?? null,
      action: "campaign_message.approve",
      resourceType: "campaign_messages",
      resourceId: campaignCompanyId,
    });
  } catch (error) {
    return { success: false, ...mapKnownError(error) };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true, message: "Mensagem aprovada." };
}

export async function sendCampaignMessageAction(
  _prev: CampaignMessageActionResult,
  formData: FormData,
): Promise<CampaignMessageActionResult> {
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const campaignCompanyId = String(formData.get("campaignCompanyId") ?? "").trim();
  if (!campaignId || !campaignCompanyId) return { success: false, message: "Dados inválidos." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    throw error;
  }

  const result = await sendCampaignMessage(supabase, organizationId, campaignCompanyId);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    organizationId,
    actorId: user?.id ?? null,
    action: "campaign_message.send",
    resourceType: "campaign_messages",
    resourceId: campaignCompanyId,
    metadata: { success: result.success },
  });

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: result.success, message: result.message };
}

/**
 * Enfileira (fila assíncrona da Fase 10) o envio de toda mensagem já
 * aprovada desta campanha, em vez de bloquear a requisição enviando uma
 * por uma — cada job roda `sendCampaignMessage` isoladamente (mesmas 4
 * checagens, incluindo supressão) e falhas de uma empresa nunca
 * impedem as outras.
 */
export async function enqueueApprovedCampaignMessagesAction(
  _prev: CampaignMessageActionResult,
  formData: FormData,
): Promise<CampaignMessageActionResult> {
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  if (!campaignId) return { success: false, message: "Campanha inválida." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    throw error;
  }

  const companies = await listCampaignCompanies(supabase, organizationId, campaignId);
  const approved = companies.filter((c) => c.messageStatus === "approved");

  if (approved.length === 0) {
    return { success: true, message: "Nenhuma mensagem aprovada pendente de envio." };
  }

  // Mesma convenção de idempotência do Módulo 1 (slot por dia): evita
  // duplicar o job se o usuário clicar "Enviar" mais de uma vez no mesmo
  // dia, mas ainda permite uma nova tentativa no dia seguinte se um job
  // anterior ficou definitivamente travado/esgotado.
  const daySlot = new Date().toISOString().slice(0, 10);
  let enqueuedCount = 0;
  for (const company of approved) {
    const result = await enqueueJob({
      jobType: "send_campaign_message",
      organizationId,
      payload: { campaignCompanyId: company.id },
      idempotencyKey: `send_campaign_message:${company.id}:${daySlot}`,
    });
    if (result) enqueuedCount += 1;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    organizationId,
    actorId: user?.id ?? null,
    action: "campaign.enqueue_sends",
    resourceType: "campaigns",
    resourceId: campaignId,
    metadata: { enqueuedCount },
  });

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true, message: `${enqueuedCount} envio${enqueuedCount === 1 ? "" : "s"} enfileirado${enqueuedCount === 1 ? "" : "s"}.` };
}
