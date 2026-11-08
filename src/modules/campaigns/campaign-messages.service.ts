import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runStructuredAI } from "@/lib/ai/engine";
import type { AIResult } from "@/lib/ai/provider";
import { campaignMessageSchema, companyAnalysisSchema, type CampaignMessageDraft } from "@/lib/ai/schemas";
import { sendGmailMessage } from "@/lib/email/gmail-smtp-client";
import { resolveOrgGmailCredentials } from "@/lib/email/resolve-org-gmail-credentials";
import { logger } from "@/lib/logger/logger";
import { getCompanyById } from "@/modules/companies/companies.service";
import { getLatestDigitalPresenceScore } from "@/modules/companies/scoring/digital-presence-score.service";
import { getOrganizationIntegrationStatus } from "@/modules/organizations/credentials.service";
import { getOrganizationProfile } from "@/modules/organizations/profile.service";
import { isContactSuppressed } from "@/modules/suppression/suppression.service";
import type { Database } from "@/types/database";

import {
  buildCampaignMessageInput,
  CAMPAIGN_MESSAGE_INSTRUCTIONS,
  PROMPT_KEYS,
  PROMPT_VERSIONS,
} from "@/modules/ai/prompts";
import { resolveDefaultRecipientEmail } from "@/modules/outreach-email/outreach-email.service";

import { getCampaignById, updateCampaignCompanyStatus } from "./campaigns.service";
import { getCampaignMessageSendBlockReason, renderCampaignMessageBody } from "./campaign-message-compose";

type Supabase = SupabaseClient<Database>;

export class CampaignNotFoundError extends Error {
  constructor() {
    super("Campanha não encontrada.");
    this.name = "CampaignNotFoundError";
  }
}

export class CampaignCompanyNotFoundError extends Error {
  constructor() {
    super("Empresa não encontrada nesta campanha.");
    this.name = "CampaignCompanyNotFoundError";
  }
}

export interface CampaignMessageRow {
  id: string;
  campaignCompanyId: string;
  recipientEmail: string | null;
  subject: string | null;
  body: string | null;
  status: "draft" | "approved" | "sent" | "failed";
  generatedByAi: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
}

function mapMessageRow(data: {
  id: string;
  campaign_company_id: string;
  recipient_email: string | null;
  subject: string | null;
  body: string | null;
  status: string;
  generated_by_ai: boolean;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  error_message: string | null;
}): CampaignMessageRow {
  return {
    id: data.id,
    campaignCompanyId: data.campaign_company_id,
    recipientEmail: data.recipient_email,
    subject: data.subject,
    body: data.body,
    status: data.status as CampaignMessageRow["status"],
    generatedByAi: data.generated_by_ai,
    approvedBy: data.approved_by,
    approvedAt: data.approved_at,
    sentAt: data.sent_at,
    errorMessage: data.error_message,
  };
}

async function getCampaignCompanyWithCompanyId(
  supabase: Supabase,
  organizationId: string,
  campaignCompanyId: string,
): Promise<{ campaignId: string; companyId: string } | null> {
  const { data, error } = await supabase
    .from("campaign_companies")
    .select("campaign_id, company_id")
    .eq("organization_id", organizationId)
    .eq("id", campaignCompanyId)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao buscar empresa da campanha", { error: error.message, organizationId, campaignCompanyId });
    throw new Error("Não foi possível carregar esta empresa da campanha.");
  }
  if (!data) return null;
  return { campaignId: data.campaign_id, companyId: data.company_id };
}

/**
 * Gera (ou regenera, enquanto ainda em rascunho) o rascunho de e-mail
 * para UMA empresa de UMA campanha — nunca em lote numa única chamada de
 * IA (cada empresa tem seu próprio contexto real, ver
 * `CAMPAIGN_MESSAGE_INSTRUCTIONS`). Alimenta a análise de empresa mais
 * recente (Fase 5) e a Pontuação de Presença Digital (Módulo 3) como
 * contexto, igual ao Módulo 5.
 */
export async function generateCampaignMessage(
  supabase: Supabase,
  organizationId: string,
  campaignCompanyId: string,
  createdBy: string | null,
): Promise<AIResult<CampaignMessageDraft>> {
  const link = await getCampaignCompanyWithCompanyId(supabase, organizationId, campaignCompanyId);
  if (!link) throw new CampaignCompanyNotFoundError();

  const campaign = await getCampaignById(supabase, organizationId, link.campaignId);
  if (!campaign) throw new CampaignNotFoundError();

  const company = await getCompanyById(supabase, organizationId, link.companyId);
  if (!company) throw new CampaignCompanyNotFoundError();

  const [organizationProfile, latestAnalysisResult, digitalPresenceScore, defaultRecipientEmail] =
    await Promise.all([
      getOrganizationProfile(supabase, organizationId),
      supabase
        .from("ai_analyses")
        .select("result")
        .eq("organization_id", organizationId)
        .eq("company_id", link.companyId)
        .eq("analysis_type", "company_analysis")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getLatestDigitalPresenceScore(supabase, organizationId, link.companyId).catch(() => null),
      resolveDefaultRecipientEmail(supabase, organizationId, link.companyId),
    ]);

  const latestCompanyAnalysis = companyAnalysisSchema.safeParse(latestAnalysisResult.data?.result).data ?? null;

  const result = await runStructuredAI(supabase, organizationId, {
    promptKey: PROMPT_KEYS.campaignMessage,
    promptVersion: PROMPT_VERSIONS.campaignMessage,
    instructions: CAMPAIGN_MESSAGE_INSTRUCTIONS,
    input: buildCampaignMessageInput(
      company,
      campaign,
      organizationProfile,
      latestCompanyAnalysis,
      digitalPresenceScore,
    ),
    schema: campaignMessageSchema,
    schemaName: "campaign_message",
  });

  if (result.status === "completed" && result.data) {
    const { error } = await supabase.from("campaign_messages").upsert(
      {
        organization_id: organizationId,
        campaign_id: link.campaignId,
        campaign_company_id: campaignCompanyId,
        channel: "email",
        recipient_email: defaultRecipientEmail,
        subject: result.data.subject,
        body: result.data.body,
        status: "draft",
        generated_by_ai: true,
        model: result.model,
        prompt_version: result.promptVersion,
        created_by: createdBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "campaign_company_id" },
    );

    if (error) {
      logger.error("Falha ao persistir rascunho de mensagem de campanha", {
        error: error.message,
        organizationId,
        campaignCompanyId,
      });
    }
  }

  return result;
}

export async function getCampaignMessage(
  supabase: Supabase,
  organizationId: string,
  campaignCompanyId: string,
): Promise<CampaignMessageRow | null> {
  const { data, error } = await supabase
    .from("campaign_messages")
    .select(
      "id, campaign_company_id, recipient_email, subject, body, status, generated_by_ai, approved_by, approved_at, sent_at, error_message",
    )
    .eq("organization_id", organizationId)
    .eq("campaign_company_id", campaignCompanyId)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao buscar mensagem de campanha", { error: error.message, organizationId, campaignCompanyId });
    throw new Error("Não foi possível carregar a mensagem desta empresa.");
  }
  if (!data) return null;
  return mapMessageRow(data);
}

/** Edição humana do rascunho (assunto/corpo/destinatário) antes de aprovar — sempre volta para "draft" se já havia sido aprovado e algo mudou. */
export async function saveCampaignMessageDraft(
  supabase: Supabase,
  organizationId: string,
  campaignCompanyId: string,
  input: { recipientEmail: string; subject: string; body: string },
  createdBy: string | null,
): Promise<void> {
  const link = await getCampaignCompanyWithCompanyId(supabase, organizationId, campaignCompanyId);
  if (!link) throw new CampaignCompanyNotFoundError();

  const { error } = await supabase.from("campaign_messages").upsert(
    {
      organization_id: organizationId,
      campaign_id: link.campaignId,
      campaign_company_id: campaignCompanyId,
      channel: "email",
      recipient_email: input.recipientEmail,
      subject: input.subject,
      body: input.body,
      status: "draft",
      generated_by_ai: false,
      approved_by: null,
      approved_at: null,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "campaign_company_id" },
  );

  if (error) {
    logger.error("Falha ao salvar rascunho de mensagem de campanha", {
      error: error.message,
      organizationId,
      campaignCompanyId,
    });
    throw new Error("Não foi possível salvar o rascunho.");
  }
}

/** Gate explícito de "quem aprovou" (audit §7) — nenhuma mensagem é enviada sem passar por aqui primeiro. */
export async function approveCampaignMessage(
  supabase: Supabase,
  organizationId: string,
  campaignCompanyId: string,
  approvedBy: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("campaign_messages")
    .update({ status: "approved", approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("campaign_company_id", campaignCompanyId)
    .eq("status", "draft");

  if (error) {
    logger.error("Falha ao aprovar mensagem de campanha", { error: error.message, organizationId, campaignCompanyId });
    throw new Error("Não foi possível aprovar esta mensagem.");
  }
}

export interface SendCampaignMessageResult {
  success: boolean;
  message: string;
}

/**
 * Envia a mensagem de UMA empresa da campanha. Ordem das checagens
 * importa: aprovação humana → lista de supressão (falha fechada) →
 * texto de descadastro configurado → Gmail configurado — exatamente as
 * mesmas 4 regras de `getCampaignMessageSendBlockReason`, repetidas aqui
 * no servidor (nunca confiar só na checagem feita na UI).
 */
export async function sendCampaignMessage(
  supabase: Supabase,
  organizationId: string,
  campaignCompanyId: string,
): Promise<SendCampaignMessageResult> {
  const campaignMessage = await getCampaignMessage(supabase, organizationId, campaignCompanyId);
  if (!campaignMessage) return { success: false, message: "Nenhuma mensagem encontrada para esta empresa." };

  const [organizationProfile, integrationStatus] = await Promise.all([
    getOrganizationProfile(supabase, organizationId),
    getOrganizationIntegrationStatus(supabase, organizationId),
  ]);

  const blockReason = getCampaignMessageSendBlockReason({
    messageStatus: campaignMessage.status,
    recipientEmail: campaignMessage.recipientEmail,
    hasUnsubscribeText: Boolean(organizationProfile.unsubscribeText?.trim()),
    gmailConfigured: integrationStatus.gmailConfigured,
  });
  if (blockReason) return { success: false, message: blockReason };

  // Falha fechada: `isContactSuppressed` já retorna `true` em caso de
  // erro de checagem (ver suppression.service.ts) — nunca envia quando
  // não é possível confirmar que o contato NÃO está suprimido.
  if (await isContactSuppressed(organizationId, "email", campaignMessage.recipientEmail!)) {
    return { success: false, message: "Este e-mail está na lista de supressão desta organização — envio bloqueado." };
  }

  const credentials = await resolveOrgGmailCredentials(organizationId);
  if (!credentials) {
    return { success: false, message: "Configure sua conta Gmail em Configurações → Integrações." };
  }

  const renderedBody = renderCampaignMessageBody(campaignMessage.body ?? "", organizationProfile.unsubscribeText!);

  let sendError: string | null = null;
  try {
    await sendGmailMessage({
      gmailAddress: credentials.gmailAddress,
      appPassword: credentials.appPassword,
      to: campaignMessage.recipientEmail!,
      subject: campaignMessage.subject ?? "",
      text: renderedBody,
    });
  } catch (error) {
    sendError = (error as Error).message;
    logger.error("Falha ao enviar mensagem de campanha via Gmail", {
      error: sendError,
      organizationId,
      campaignCompanyId,
    });
  }

  const { error: updateError } = await supabase
    .from("campaign_messages")
    .update({
      status: sendError ? "failed" : "sent",
      rendered_body: renderedBody,
      sent_at: sendError ? null : new Date().toISOString(),
      error_message: sendError,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("campaign_company_id", campaignCompanyId);

  if (updateError) {
    logger.error("Falha ao registrar envio de mensagem de campanha", {
      error: updateError.message,
      organizationId,
      campaignCompanyId,
    });
  }

  if (!sendError) {
    await updateCampaignCompanyStatus(supabase, organizationId, campaignCompanyId, "contacted");
  }

  if (sendError) return { success: false, message: `Falha ao enviar: ${sendError}` };
  return { success: true, message: `E-mail enviado para ${campaignMessage.recipientEmail}.` };
}
