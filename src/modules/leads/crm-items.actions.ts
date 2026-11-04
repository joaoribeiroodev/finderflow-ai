"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { contactCreateSchema } from "@/lib/validation/contacts";
import { interactionCreateSchema } from "@/lib/validation/interactions";
import { taskCreateSchema, taskStatusUpdateSchema } from "@/lib/validation/tasks";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import { createContact, createInteraction, createTask, deleteContact, updateTaskStatus } from "./crm-items.service";

export interface SimpleActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

function describe(error: unknown, fallback: string): string {
  if (error instanceof PermissionError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

export async function createContactAction(
  _prev: SimpleActionResult,
  formData: FormData,
): Promise<SimpleActionResult> {
  const parsed = contactCreateSchema.safeParse({
    companyId: formData.get("companyId"),
    name: formData.get("name"),
    position: formData.get("position"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    preferredChannel: formData.get("preferredChannel"),
  });
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();
  const leadId = formData.get("leadId");

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await createContact(supabase, organizationId, parsed.data);
  } catch (error) {
    return { success: false, message: describe(error, "Não foi possível cadastrar o contato.") };
  }

  if (typeof leadId === "string" && leadId.length > 0) revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const contactId = formData.get("contactId");
  const leadId = formData.get("leadId");
  if (typeof contactId !== "string" || contactId.length === 0) return;

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);
  await deleteContact(supabase, organizationId, contactId);

  if (typeof leadId === "string" && leadId.length > 0) revalidatePath(`/leads/${leadId}`);
}

export async function createInteractionAction(
  _prev: SimpleActionResult,
  formData: FormData,
): Promise<SimpleActionResult> {
  const parsed = interactionCreateSchema.safeParse({
    leadId: formData.get("leadId"),
    type: formData.get("type"),
    contentSummary: formData.get("contentSummary"),
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await createInteraction(supabase, organizationId, parsed.data);
  } catch (error) {
    return { success: false, message: describe(error, "Não foi possível registrar a interação.") };
  }

  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: true };
}

export async function createTaskAction(
  _prev: SimpleActionResult,
  formData: FormData,
): Promise<SimpleActionResult> {
  const parsed = taskCreateSchema.safeParse({
    leadId: formData.get("leadId"),
    title: formData.get("title"),
    description: formData.get("description"),
    dueAt: formData.get("dueAt"),
  });
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await createTask(supabase, organizationId, parsed.data);
  } catch (error) {
    return { success: false, message: describe(error, "Não foi possível criar a tarefa.") };
  }

  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: true };
}

export async function updateTaskStatusAction(formData: FormData): Promise<void> {
  const leadId = formData.get("leadId");
  const parsed = taskStatusUpdateSchema.safeParse({
    taskId: formData.get("taskId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);
  await updateTaskStatus(supabase, organizationId, parsed.data.taskId, parsed.data.status);

  if (typeof leadId === "string" && leadId.length > 0) revalidatePath(`/leads/${leadId}`);
}
