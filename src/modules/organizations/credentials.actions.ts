"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { logger } from "@/lib/logger/logger";

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
  }
  revalidatePath("/settings");
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
  }
  revalidatePath("/settings");
}
