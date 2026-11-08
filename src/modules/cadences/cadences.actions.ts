"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logAudit } from "@/lib/audit/audit-log";
import { logger } from "@/lib/logger/logger";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import { addCadenceStep, createCadence, DuplicateStepOrderError, removeCadenceStep, updateCadenceStatus } from "./cadences.service";
import type { CadenceStatus } from "./cadences.service";

export interface CadenceActionResult {
  success: boolean;
  message?: string;
}

export async function createCadenceAction(
  _prev: CadenceActionResult,
  formData: FormData,
): Promise<CadenceActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!name) return { success: false, message: "Informe um nome para a cadência." };

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

  let cadenceId: string;
  try {
    const cadence = await createCadence(supabase, organizationId, { name, description }, user?.id ?? null);
    cadenceId = cadence.id;
  } catch (error) {
    logger.error("Falha ao criar cadência", { error: (error as Error).message, organizationId });
    return { success: false, message: "Não foi possível criar a cadência." };
  }

  await logAudit({
    organizationId,
    actorId: user?.id ?? null,
    action: "cadence.create",
    resourceType: "cadences",
    resourceId: cadenceId,
    metadata: { name },
  });

  revalidatePath("/cadences");
  redirect(`/cadences/${cadenceId}`);
}

export async function updateCadenceStatusAction(
  _prev: CadenceActionResult,
  formData: FormData,
): Promise<CadenceActionResult> {
  const cadenceId = String(formData.get("cadenceId") ?? "").trim();
  const status = String(formData.get("status") ?? "") as CadenceStatus;

  if (!cadenceId) return { success: false, message: "Cadência inválida." };
  if (!["active", "archived"].includes(status)) return { success: false, message: "Status inválido." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await updateCadenceStatus(supabase, organizationId, cadenceId, status);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    logger.error("Falha ao atualizar status da cadência", { error: (error as Error).message, organizationId, cadenceId });
    return { success: false, message: "Não foi possível atualizar o status." };
  }

  revalidatePath(`/cadences/${cadenceId}`);
  revalidatePath("/cadences");
  return { success: true };
}

export async function addCadenceStepAction(
  _prev: CadenceActionResult,
  formData: FormData,
): Promise<CadenceActionResult> {
  const cadenceId = String(formData.get("cadenceId") ?? "").trim();
  const stepOrder = Number(formData.get("stepOrder") ?? "");
  const dayOffset = Number(formData.get("dayOffset") ?? "");
  const subjectTemplate = String(formData.get("subjectTemplate") ?? "").trim();
  const bodyTemplate = String(formData.get("bodyTemplate") ?? "").trim();

  if (!cadenceId) return { success: false, message: "Cadência inválida." };
  if (!Number.isInteger(stepOrder) || stepOrder < 1) {
    return { success: false, message: "A ordem da etapa precisa ser um número inteiro a partir de 1." };
  }
  if (!Number.isInteger(dayOffset) || dayOffset < 0) {
    return { success: false, message: "O dia de envio precisa ser 0 ou maior." };
  }
  if (!subjectTemplate) return { success: false, message: "Informe o assunto do e-mail desta etapa." };
  if (!bodyTemplate) return { success: false, message: "Informe o corpo do e-mail desta etapa." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await addCadenceStep(supabase, organizationId, cadenceId, { stepOrder, dayOffset, subjectTemplate, bodyTemplate });
  } catch (error) {
    if (error instanceof PermissionError || error instanceof DuplicateStepOrderError) {
      return { success: false, message: error.message };
    }
    logger.error("Falha ao adicionar etapa de cadência", { error: (error as Error).message, organizationId, cadenceId });
    return { success: false, message: "Não foi possível adicionar a etapa." };
  }

  revalidatePath(`/cadences/${cadenceId}`);
  return { success: true, message: "Etapa adicionada." };
}

export async function removeCadenceStepAction(
  _prev: CadenceActionResult,
  formData: FormData,
): Promise<CadenceActionResult> {
  const cadenceId = String(formData.get("cadenceId") ?? "").trim();
  const stepId = String(formData.get("stepId") ?? "").trim();
  if (!cadenceId || !stepId) return { success: false, message: "Dados inválidos." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await removeCadenceStep(supabase, organizationId, stepId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    logger.error("Falha ao remover etapa de cadência", { error: (error as Error).message, organizationId, stepId });
    return { success: false, message: "Não foi possível remover a etapa." };
  }

  revalidatePath(`/cadences/${cadenceId}`);
  return { success: true, message: "Etapa removida." };
}
