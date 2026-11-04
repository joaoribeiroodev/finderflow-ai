"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { assertCanEditOrganization } from "@/lib/permissions/permissions";
import { dealCloseSchema } from "@/lib/validation/deals";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { getProposalDetail, ProposalNotFoundError } from "@/modules/proposals/proposals.service";

import { closeDeal, createDealFromProposal } from "./deals.service";

export interface DealActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createDealFromProposalAction(formData: FormData): Promise<void> {
  const proposalId = formData.get("proposalId");
  if (typeof proposalId !== "string" || proposalId.length === 0) return;

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);
  const proposal = await getProposalDetail(supabase, organizationId, proposalId);
  if (!proposal || !proposal.lead) throw new ProposalNotFoundError();

  const title = `Proposta ${proposal.proposal_number}${proposal.lead.company ? ` — ${proposal.lead.company.name}` : ""}`;
  await createDealFromProposal(
    supabase,
    organizationId,
    proposalId,
    proposal.lead.id,
    title,
    Number(proposal.total_amount),
  );

  revalidatePath(`/proposals/${proposalId}`);
}

export async function closeDealAction(
  _prev: DealActionResult,
  formData: FormData,
): Promise<DealActionResult> {
  const dealId = formData.get("dealId");
  const proposalId = formData.get("proposalId");
  if (typeof dealId !== "string" || typeof proposalId !== "string") {
    return { success: false, message: "Negócio inválido." };
  }

  const parsed = dealCloseSchema.safeParse({
    status: formData.get("status"),
    lostReason: formData.get("lostReason"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await closeDeal(supabase, organizationId, dealId, parsed.data.status, parsed.data.lostReason);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Não foi possível encerrar o negócio.",
    };
  }

  revalidatePath(`/proposals/${proposalId}`);
  return { success: true };
}
