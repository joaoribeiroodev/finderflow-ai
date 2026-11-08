"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit/audit-log";
import { logger } from "@/lib/logger/logger";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import {
  AlreadyEnrolledError,
  CadenceHasNoStepsError,
  enrollLeadInCadence,
  pauseCadenceEnrollment,
  resumeCadenceEnrollment,
  stopCadenceEnrollment,
} from "./cadence-enrollments.service";

export interface CadenceEnrollmentActionResult {
  success: boolean;
  message?: string;
}

export async function enrollLeadInCadenceAction(
  _prev: CadenceEnrollmentActionResult,
  formData: FormData,
): Promise<CadenceEnrollmentActionResult> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const cadenceId = String(formData.get("cadenceId") ?? "").trim();
  if (!leadId || !cadenceId) return { success: false, message: "Dados inválidos." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await enrollLeadInCadence(supabase, organizationId, cadenceId, leadId);
  } catch (error) {
    if (error instanceof PermissionError || error instanceof AlreadyEnrolledError || error instanceof CadenceHasNoStepsError) {
      return { success: false, message: error.message };
    }
    logger.error("Falha ao inscrever lead em cadência", { error: (error as Error).message, organizationId, leadId, cadenceId });
    return { success: false, message: "Não foi possível inscrever o lead nesta cadência." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    organizationId,
    actorId: user?.id ?? null,
    action: "cadence_enrollment.create",
    resourceType: "cadence_enrollments",
    resourceId: leadId,
    metadata: { cadenceId },
  });

  revalidatePath(`/leads/${leadId}`);
  return { success: true, message: "Lead inscrito na cadência." };
}

async function updateEnrollment(
  formData: FormData,
  action: (supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, enrollmentId: string) => Promise<void>,
  auditAction: string,
): Promise<CadenceEnrollmentActionResult> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const enrollmentId = String(formData.get("enrollmentId") ?? "").trim();
  if (!leadId || !enrollmentId) return { success: false, message: "Dados inválidos." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await action(supabase, organizationId, enrollmentId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    logger.error("Falha ao atualizar inscrição de cadência", {
      error: (error as Error).message,
      organizationId,
      enrollmentId,
    });
    return { success: false, message: "Não foi possível atualizar esta inscrição." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    organizationId,
    actorId: user?.id ?? null,
    action: auditAction,
    resourceType: "cadence_enrollments",
    resourceId: enrollmentId,
  });

  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function pauseCadenceEnrollmentAction(
  _prev: CadenceEnrollmentActionResult,
  formData: FormData,
): Promise<CadenceEnrollmentActionResult> {
  return updateEnrollment(formData, pauseCadenceEnrollment, "cadence_enrollment.pause");
}

export async function resumeCadenceEnrollmentAction(
  _prev: CadenceEnrollmentActionResult,
  formData: FormData,
): Promise<CadenceEnrollmentActionResult> {
  return updateEnrollment(formData, resumeCadenceEnrollment, "cadence_enrollment.resume");
}

/**
 * "Marcar como respondeu" — condição de parada manual explícita pedida
 * na auditoria (seção 9, Módulo 7): o usuário confirma que o lead já
 * respondeu, então a cadência automática para de continuar contatando.
 */
export async function markCadenceEnrollmentRespondedAction(
  _prev: CadenceEnrollmentActionResult,
  formData: FormData,
): Promise<CadenceEnrollmentActionResult> {
  return updateEnrollment(
    formData,
    (supabase, organizationId, enrollmentId) => stopCadenceEnrollment(supabase, organizationId, enrollmentId, "responded"),
    "cadence_enrollment.stop_responded",
  );
}
