"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { leadDetailsUpdateSchema, leadMoveStageSchema } from "@/lib/validation/leads";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import { archiveLead, InvalidStageTransitionError, moveLeadStage, updateLeadDetails } from "./leads.service";

export interface LeadActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function moveLeadStageAction(
  _prev: LeadActionResult,
  formData: FormData,
): Promise<LeadActionResult> {
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || leadId.length === 0) {
    return { success: false, message: "Lead inválido." };
  }

  const parsed = leadMoveStageSchema.safeParse({
    stageId: formData.get("stageId"),
    lossReason: formData.get("lossReason"),
  });
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await moveLeadStage(supabase, leadId, parsed.data.stageId, parsed.data.lossReason);
  } catch (error) {
    if (error instanceof InvalidStageTransitionError || error instanceof PermissionError) {
      return { success: false, message: error.message };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : "Não foi possível mover o lead.",
    };
  }

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function updateLeadDetailsAction(
  _prev: LeadActionResult,
  formData: FormData,
): Promise<LeadActionResult> {
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || leadId.length === 0) {
    return { success: false, message: "Lead inválido." };
  }

  const parsed = leadDetailsUpdateSchema.safeParse({
    priority: formData.get("priority"),
    estimatedValue: formData.get("estimatedValue"),
    probability: formData.get("probability"),
    serviceInterest: formData.get("serviceInterest"),
    nextContactAt: formData.get("nextContactAt"),
  });
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await updateLeadDetails(supabase, organizationId, leadId, parsed.data);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    return {
      success: false,
      message: error instanceof Error ? error.message : "Não foi possível atualizar o lead.",
    };
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { success: true };
}

export async function archiveLeadAction(formData: FormData): Promise<void> {
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || leadId.length === 0) redirect("/leads");

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);
  await archiveLead(supabase, organizationId, leadId);

  revalidatePath("/leads");
  revalidatePath("/pipeline");
  redirect("/leads");
}
