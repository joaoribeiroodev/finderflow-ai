"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { resolveOrgAsaasCredentials } from "@/modules/organizations/asaas-credentials";
import { saveAsaasInvoiceCustomization } from "@/lib/contracts/asaas-charges-client";
import { logger } from "@/lib/logger/logger";
import { logAudit } from "@/lib/audit/audit-log";

export interface CredentialsActionResult {
  success: boolean;
  message?: string;
}

/**
 * Credenciais Asaas/OpenAI configuráveis por organização (Fase 9 — ver
 * docs/DECISIONS.md). Nunca passam por uma tabela em texto puro: as
 * funções `set_org_*_credentials`/`clear_org_*_credentials` (Supabase
 * Vault) fazem a validação de papel (owner/admin) e a escrita; aqui só
 * chamamos a RPC e tratamos o resultado.
 */
export async function saveAsaasCredentialsAction(
  _prev: CredentialsActionResult,
  formData: FormData,
): Promise<CredentialsActionResult> {
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const environment = formData.get("environment") === "production" ? "production" : "sandbox";

  if (!apiKey) {
    return { success: false, message: "Informe a chave de API da Asaas." };
  }

  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_org_asaas_credentials", {
    p_org: org.organizationId,
    p_api_key: apiKey,
    p_environment: environment,
  });

  if (error) {
    logger.error("Falha ao salvar credenciais Asaas da organização", {
      error: error.message,
      organizationId: org.organizationId,
    });
    return {
      success: false,
      message: "Não foi possível salvar a chave da Asaas. Confirme que você é owner/admin da organização.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    organizationId: org.organizationId,
    actorId: user?.id ?? null,
    action: "integration_credentials.set",
    resourceType: "organization_integration_credentials",
    metadata: { provider: "asaas", environment },
  });

  revalidatePath("/settings");
  return { success: true, message: "Chave da Asaas salva com sucesso." };
}

export async function clearAsaasCredentialsAction(): Promise<void> {
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_org_asaas_credentials", { p_org: org.organizationId });
  if (error) {
    logger.error("Falha ao remover credenciais Asaas da organização", {
      error: error.message,
      organizationId: org.organizationId,
    });
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await logAudit({
      organizationId: org.organizationId,
      actorId: user?.id ?? null,
      action: "integration_credentials.clear",
      resourceType: "organization_integration_credentials",
      metadata: { provider: "asaas" },
    });
  }
  revalidatePath("/settings");
}

/**
 * Personalização da tela de fatura/pagamento da Asaas (logo + cores) —
 * ver `saveAsaasInvoiceCustomization` para o que a API aceita e como o
 * envio passa por revisão da própria Asaas antes de valer de verdade.
 * Usa a mesma chave Asaas já configurada por esta organização; não
 * grava nada no nosso banco (não há o que guardar — a Asaas é quem
 * mantém o estado da personalização).
 */
export async function saveAsaasInvoiceCustomizationAction(
  _prev: CredentialsActionResult,
  formData: FormData,
): Promise<CredentialsActionResult> {
  const logoBackgroundColor = String(formData.get("logoBackgroundColor") ?? "").trim();
  const infoBackgroundColor = String(formData.get("infoBackgroundColor") ?? "").trim();
  const fontColor = String(formData.get("fontColor") ?? "").trim();
  const enabled = formData.get("enabled") === "on";
  const logoFileEntry = formData.get("logoFile");
  const logoFile = logoFileEntry instanceof File && logoFileEntry.size > 0 ? logoFileEntry : null;

  if (!logoBackgroundColor || !infoBackgroundColor || !fontColor) {
    return { success: false, message: "Escolha as três cores antes de salvar." };
  }

  const org = await requireActiveOrganization();
  const credentials = await resolveOrgAsaasCredentials(org.organizationId);
  if (!credentials) {
    return {
      success: false,
      message: "Configure a chave de API da Asaas desta organização antes de personalizar a fatura.",
    };
  }

  try {
    await saveAsaasInvoiceCustomization(credentials.baseUrl, credentials.apiKey, {
      logoBackgroundColor,
      infoBackgroundColor,
      fontColor,
      enabled,
      logoFile,
    });
  } catch (error) {
    logger.error("Falha ao salvar personalização de fatura Asaas", {
      error: (error as Error).message,
      organizationId: org.organizationId,
    });
    return {
      success: false,
      message: (error as Error).message || "Não foi possível salvar a personalização na Asaas.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    organizationId: org.organizationId,
    actorId: user?.id ?? null,
    action: "integration_credentials.update",
    resourceType: "organization_integration_credentials",
    metadata: { provider: "asaas", change: "invoice_customization" },
  });

  revalidatePath("/settings");
  return {
    success: true,
    message: "Enviado para a Asaas — a revisão deles costuma levar algumas horas antes de valer na fatura.",
  };
}

export async function saveOpenAiCredentialsAction(
  _prev: CredentialsActionResult,
  formData: FormData,
): Promise<CredentialsActionResult> {
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim() || null;

  if (!apiKey) {
    return { success: false, message: "Informe a chave de API da OpenAI." };
  }

  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_org_openai_credentials", {
    p_org: org.organizationId,
    p_api_key: apiKey,
    p_model: model ?? undefined,
  });

  if (error) {
    logger.error("Falha ao salvar credenciais OpenAI da organização", {
      error: error.message,
      organizationId: org.organizationId,
    });
    return {
      success: false,
      message: "Não foi possível salvar a chave da OpenAI. Confirme que você é owner/admin da organização.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    organizationId: org.organizationId,
    actorId: user?.id ?? null,
    action: "integration_credentials.set",
    resourceType: "organization_integration_credentials",
    metadata: { provider: "openai" },
  });

  revalidatePath("/settings");
  return { success: true, message: "Chave da OpenAI salva com sucesso." };
}

export async function clearOpenAiCredentialsAction(): Promise<void> {
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_org_openai_credentials", { p_org: org.organizationId });
  if (error) {
    logger.error("Falha ao remover credenciais OpenAI da organização", {
      error: error.message,
      organizationId: org.organizationId,
    });
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await logAudit({
      organizationId: org.organizationId,
      actorId: user?.id ?? null,
      action: "integration_credentials.clear",
      resourceType: "organization_integration_credentials",
      metadata: { provider: "openai" },
    });
  }
  revalidatePath("/settings");
}

/**
 * Conta Gmail da organização usada para enviar e-mails de prospecção
 * (Fase 9) — endereço + senha de app (não a senha normal da conta;
 * gerada em myaccount.google.com/apppasswords, exige verificação em
 * duas etapas ativada). Mesmo padrão de Vault das demais credenciais.
 */
export async function saveGmailCredentialsAction(
  _prev: CredentialsActionResult,
  formData: FormData,
): Promise<CredentialsActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const appPassword = String(formData.get("appPassword") ?? "").trim();

  if (!email || !email.includes("@")) {
    return { success: false, message: "Informe um e-mail Gmail válido." };
  }
  if (!appPassword) {
    return { success: false, message: "Informe a senha de app gerada pelo Google." };
  }

  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_org_gmail_credentials", {
    p_org: org.organizationId,
    p_email: email,
    p_app_password: appPassword,
  });

  if (error) {
    logger.error("Falha ao salvar credenciais Gmail da organização", {
      error: error.message,
      organizationId: org.organizationId,
    });
    return {
      success: false,
      message: "Não foi possível salvar a conta Gmail. Confirme que você é owner/admin da organização.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    organizationId: org.organizationId,
    actorId: user?.id ?? null,
    action: "integration_credentials.set",
    resourceType: "organization_integration_credentials",
    metadata: { provider: "gmail" },
  });

  revalidatePath("/settings");
  return { success: true, message: "Conta Gmail conectada com sucesso." };
}

/**
 * Chave de API da Google PageSpeed Insights, usada pelo Módulo 2
 * (Website Audit) — gratuita, cota generosa (25k req/dia), não exige
 * faturamento habilitado no Google Cloud (ver docs/DECISIONS.md e
 * migration 20261108054539_module2_website_audit.sql).
 */
export async function savePageSpeedCredentialsAction(
  _prev: CredentialsActionResult,
  formData: FormData,
): Promise<CredentialsActionResult> {
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  if (!apiKey) {
    return { success: false, message: "Informe a chave de API da PageSpeed Insights." };
  }

  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_org_pagespeed_credentials", {
    p_org: org.organizationId,
    p_api_key: apiKey,
  });

  if (error) {
    logger.error("Falha ao salvar credenciais PageSpeed da organização", {
      error: error.message,
      organizationId: org.organizationId,
    });
    return {
      success: false,
      message: "Não foi possível salvar a chave da PageSpeed. Confirme que você é owner/admin da organização.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    organizationId: org.organizationId,
    actorId: user?.id ?? null,
    action: "integration_credentials.set",
    resourceType: "organization_integration_credentials",
    metadata: { provider: "pagespeed" },
  });

  revalidatePath("/settings");
  return { success: true, message: "Chave da PageSpeed Insights salva com sucesso." };
}

export async function clearPageSpeedCredentialsAction(): Promise<void> {
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_org_pagespeed_credentials", { p_org: org.organizationId });
  if (error) {
    logger.error("Falha ao remover credenciais PageSpeed da organização", {
      error: error.message,
      organizationId: org.organizationId,
    });
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await logAudit({
      organizationId: org.organizationId,
      actorId: user?.id ?? null,
      action: "integration_credentials.clear",
      resourceType: "organization_integration_credentials",
      metadata: { provider: "pagespeed" },
    });
  }
  revalidatePath("/settings");
}

export async function clearGmailCredentialsAction(): Promise<void> {
  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_org_gmail_credentials", { p_org: org.organizationId });
  if (error) {
    logger.error("Falha ao remover credenciais Gmail da organização", {
      error: error.message,
      organizationId: org.organizationId,
    });
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await logAudit({
      organizationId: org.organizationId,
      actorId: user?.id ?? null,
      action: "integration_credentials.clear",
      resourceType: "organization_integration_credentials",
      metadata: { provider: "gmail" },
    });
  }
  revalidatePath("/settings");
}
