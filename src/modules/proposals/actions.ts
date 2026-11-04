"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import {
  proposalCreateSchema,
  proposalItemSchema,
  isAllowedProposalTransition,
  type ProposalStatus,
} from "@/lib/validation/proposals";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import {
  addProposalItem,
  createProposal,
  getProposalDetail,
  InvalidStatusTransitionError,
  LeadNotFoundError,
  ProposalNotFoundError,
  removeProposalItem,
  updateProposalStatus,
  updateProposalValidUntil,
} from "./proposals.service";
import { generateProposalPdf } from "./pdf.service";

export interface ProposalActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createProposalAction(
  _prev: ProposalActionResult,
  formData: FormData,
): Promise<ProposalActionResult> {
  const parsed = proposalCreateSchema.safeParse({
    leadId: formData.get("leadId"),
    validUntil: formData.get("validUntil"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  let proposalId: string;
  try {
    await assertCanEditOrganization(supabase, organizationId);
    const proposal = await createProposal(supabase, organizationId, parsed.data.leadId, parsed.data.validUntil);
    proposalId = proposal.id;
  } catch (error) {
    if (error instanceof LeadNotFoundError || error instanceof PermissionError) {
      return { success: false, message: error.message };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : "Não foi possível criar a proposta.",
    };
  }

  revalidatePath("/proposals");
  redirect(`/proposals/${proposalId}`);
}

export async function addProposalItemAction(
  _prev: ProposalActionResult,
  formData: FormData,
): Promise<ProposalActionResult> {
  const proposalId = formData.get("proposalId");
  if (typeof proposalId !== "string" || proposalId.length === 0) {
    return { success: false, message: "Proposta inválida." };
  }

  const parsed = proposalItemSchema.safeParse({
    serviceId: formData.get("serviceId"),
    description: formData.get("description"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await addProposalItem(supabase, organizationId, proposalId, parsed.data);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Não foi possível adicionar o item.",
    };
  }

  revalidatePath(`/proposals/${proposalId}`);
  return { success: true };
}

export async function removeProposalItemAction(formData: FormData): Promise<void> {
  const proposalId = formData.get("proposalId");
  const itemId = formData.get("itemId");
  if (typeof proposalId !== "string" || typeof itemId !== "string") return;

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);
  await removeProposalItem(supabase, organizationId, itemId);

  revalidatePath(`/proposals/${proposalId}`);
}

export async function changeProposalStatusAction(formData: FormData): Promise<void> {
  const proposalId = formData.get("proposalId");
  const currentStatus = formData.get("currentStatus");
  const newStatus = formData.get("newStatus");
  if (
    typeof proposalId !== "string" ||
    typeof currentStatus !== "string" ||
    typeof newStatus !== "string"
  ) {
    return;
  }

  if (!isAllowedProposalTransition(currentStatus as ProposalStatus, newStatus as ProposalStatus)) {
    throw new InvalidStatusTransitionError(currentStatus, newStatus);
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);
  await updateProposalStatus(supabase, organizationId, proposalId, newStatus as ProposalStatus);

  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/proposals");
}

export async function generateProposalPdfAction(formData: FormData): Promise<void> {
  const proposalId = formData.get("proposalId");
  if (typeof proposalId !== "string" || proposalId.length === 0) return;

  const supabase = await createClient();
  const { organizationId, organizationName } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);
  const proposal = await getProposalDetail(supabase, organizationId, proposalId);
  if (!proposal) throw new ProposalNotFoundError();

  await generateProposalPdf(supabase, organizationId, organizationName, proposal);

  revalidatePath(`/proposals/${proposalId}`);
}

export async function updateProposalValidUntilAction(formData: FormData): Promise<void> {
  const proposalId = formData.get("proposalId");
  const validUntilRaw = formData.get("validUntil");
  if (typeof proposalId !== "string") return;

  const validUntil = typeof validUntilRaw === "string" && validUntilRaw.length > 0 ? validUntilRaw : undefined;

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);
  await updateProposalValidUntil(supabase, organizationId, proposalId, validUntil);

  revalidatePath(`/proposals/${proposalId}`);
}
