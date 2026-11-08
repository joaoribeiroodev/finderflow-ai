"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/audit/audit-log";
import { logger } from "@/lib/logger/logger";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import { addCompaniesToCampaign, createCampaign, updateCampaignCompanyStatus } from "./campaigns.service";
import type { CampaignCompanyStatus } from "./campaigns.service";

export interface CampaignActionResult {
  success: boolean;
  message?: string;
}

export async function createCampaignAction(
  _prev: CampaignActionResult,
  formData: FormData,
): Promise<CampaignActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim() || null;

  if (!name) return { success: false, message: "Informe um nome para a campanha." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    throw error;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let campaignId: string;
  try {
    const campaign = await createCampaign(supabase, organizationId, { name, objective }, user?.id ?? null);
    campaignId = campaign.id;
  } catch (error) {
    logger.error("Falha ao criar campanha", { error: (error as Error).message, organizationId });
    return { success: false, message: "Não foi possível criar a campanha." };
  }

  await logAudit({
    organizationId,
    actorId: user?.id ?? null,
    action: "campaign.create",
    resourceType: "campaigns",
    resourceId: campaignId,
    metadata: { name },
  });

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaignId}`);
}

export async function addCompaniesToCampaignAction(
  _prev: CampaignActionResult,
  formData: FormData,
): Promise<CampaignActionResult> {
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const companyIds = formData.getAll("companyId").map(String).filter(Boolean);

  if (!campaignId) return { success: false, message: "Campanha inválida." };
  if (companyIds.length === 0) {
    return { success: false, message: "Selecione pelo menos uma empresa." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    throw error;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let addedCount: number;
  try {
    addedCount = await addCompaniesToCampaign(supabase, organizationId, campaignId, companyIds, user?.id ?? null);
  } catch (error) {
    logger.error("Falha ao adicionar empresas à campanha", {
      error: (error as Error).message,
      organizationId,
      campaignId,
    });
    return { success: false, message: "Não foi possível adicionar as empresas." };
  }

  await logAudit({
    organizationId,
    actorId: user?.id ?? null,
    action: "campaign.add_companies",
    resourceType: "campaigns",
    resourceId: campaignId,
    metadata: { requestedCount: companyIds.length, addedCount },
  });

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true, message: `${addedCount} empresa${addedCount === 1 ? "" : "s"} adicionada${addedCount === 1 ? "" : "s"}.` };
}

export async function updateCampaignCompanyStatusAction(
  _prev: CampaignActionResult,
  formData: FormData,
): Promise<CampaignActionResult> {
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const campaignCompanyId = String(formData.get("campaignCompanyId") ?? "").trim();
  const status = String(formData.get("status") ?? "") as CampaignCompanyStatus;

  if (!campaignId || !campaignCompanyId) return { success: false, message: "Dados inválidos." };
  if (!["selected", "excluded", "contacted", "responded"].includes(status)) {
    return { success: false, message: "Status inválido." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await updateCampaignCompanyStatus(supabase, organizationId, campaignCompanyId, status);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    logger.error("Falha ao atualizar status da empresa na campanha", {
      error: (error as Error).message,
      organizationId,
      campaignCompanyId,
    });
    return { success: false, message: "Não foi possível atualizar o status." };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  return { success: true };
}
