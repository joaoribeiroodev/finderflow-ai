"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logger } from "@/lib/logger/logger";
import { createClient } from "@/lib/supabase/server";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { stageCreateSchema, stageMoveDirectionSchema, stageUpdateSchema } from "@/lib/validation/pipeline";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import { createStage, deleteStage, moveStage, StageHasLeadsError, StageNameTakenError, updateStage } from "./pipeline.service";

export interface StageActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof StageNameTakenError || error instanceof StageHasLeadsError) return error.message;
  if (error instanceof PermissionError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

export async function createStageAction(
  _prev: StageActionResult,
  formData: FormData,
): Promise<StageActionResult> {
  const parsed = stageCreateSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || undefined,
    resultType: formData.get("resultType"),
  });
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await createStage(supabase, organizationId, parsed.data);
  } catch (error) {
    return { success: false, message: describeError(error, "Não foi possível criar a etapa.") };
  }

  revalidatePath("/pipeline");
  return { success: true };
}

export async function updateStageAction(
  _prev: StageActionResult,
  formData: FormData,
): Promise<StageActionResult> {
  const parsed = stageUpdateSchema.safeParse({
    stageId: formData.get("stageId"),
    name: formData.get("name"),
    color: formData.get("color") || undefined,
    resultType: formData.get("resultType"),
  });
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await updateStage(supabase, organizationId, parsed.data);
  } catch (error) {
    return { success: false, message: describeError(error, "Não foi possível atualizar a etapa.") };
  }

  revalidatePath("/pipeline");
  return { success: true };
}

export async function deleteStageAction(formData: FormData): Promise<void> {
  const stageId = formData.get("stageId");
  if (typeof stageId !== "string" || stageId.length === 0) {
    redirect("/pipeline");
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);

  // `redirect()` fica fora do try (ver bug documentado na Fase 3:
  // NEXT_REDIRECT engolido por um catch genérico).
  let errorMessage: string | null = null;
  try {
    await deleteStage(supabase, organizationId, stageId);
  } catch (error) {
    errorMessage = describeError(error, "Não foi possível excluir a etapa.");
    logger.error("Falha ao excluir etapa do pipeline", { error: errorMessage, organizationId, stageId });
  }

  revalidatePath("/pipeline");
  redirect(errorMessage ? `/pipeline?stageError=${encodeURIComponent(errorMessage)}` : "/pipeline");
}

export async function moveStageAction(formData: FormData): Promise<void> {
  const parsed = stageMoveDirectionSchema.safeParse({
    stageId: formData.get("stageId"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);
  await moveStage(supabase, organizationId, parsed.data.stageId, parsed.data.direction);

  revalidatePath("/pipeline");
}
