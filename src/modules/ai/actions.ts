"use server";

import { revalidatePath } from "next/cache";

import { AIProviderNotConfiguredError } from "@/lib/ai/provider";
import { AIQuotaExceededError } from "@/lib/ai/quota";
import type { CompanyAnalysis, LeadScoreResult, OutreachMessage, ProposalDraft, SalesInsights } from "@/lib/ai/schemas";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import { analyzeCompany, CompanyNotFoundError } from "./company-analyzer.service";
import { LeadNotFoundError, scoreLead } from "./lead-scorer.service";
import { generateOutreachMessage, type OutreachChannel } from "./outreach-generator.service";
import { generateProposalDraft, LeadNotFoundForDraftError } from "./proposal-assistant.service";
import { generateSalesInsights, type PeriodPreset } from "./sales-analyst.service";

/**
 * Resultado comum das actions de IA. `data`/`status`/`warnings` vêm
 * diretamente do `AIResult` (ver `src/lib/ai/provider.ts`) — a UI decide
 * como exibir cada `status` (recusa, incompleto, falha) honestamente,
 * em vez de tratar tudo como sucesso binário.
 */
export interface AIActionResult<T> {
  success: boolean;
  message?: string;
  status?: "completed" | "refused" | "incomplete" | "failed";
  data?: T | null;
  warnings?: string[];
  /** true quando o motivo de não ter rodado é falta de configuração (OPENAI_API_KEY ausente) — a UI mostra um zero-state específico, não um erro genérico. */
  notConfigured?: boolean;
}

function mapKnownError(error: unknown): { message: string; notConfigured?: boolean } {
  if (error instanceof AIProviderNotConfiguredError) {
    return { message: error.message, notConfigured: true };
  }
  if (
    error instanceof AIQuotaExceededError ||
    error instanceof PermissionError ||
    error instanceof CompanyNotFoundError ||
    error instanceof LeadNotFoundError ||
    error instanceof LeadNotFoundForDraftError
  ) {
    return { message: error.message };
  }
  return { message: error instanceof Error ? error.message : "Falha inesperada." };
}

export async function analyzeCompanyAction(
  _prev: AIActionResult<CompanyAnalysis>,
  formData: FormData,
): Promise<AIActionResult<CompanyAnalysis>> {
  const companyId = formData.get("companyId");
  if (typeof companyId !== "string" || companyId.length === 0) {
    return { success: false, message: "Empresa inválida." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const result = await analyzeCompany(supabase, organizationId, companyId);
    revalidatePath(`/companies/${companyId}`);
    return {
      success: result.status === "completed",
      status: result.status,
      data: result.data,
      warnings: result.warnings,
      message: result.errorMessage,
    };
  } catch (error) {
    return { success: false, ...mapKnownError(error) };
  }
}

export async function scoreLeadAction(
  _prev: AIActionResult<LeadScoreResult>,
  formData: FormData,
): Promise<AIActionResult<LeadScoreResult>> {
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || leadId.length === 0) {
    return { success: false, message: "Lead inválido." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const result = await scoreLead(supabase, organizationId, leadId);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
    return {
      success: result.status === "completed",
      status: result.status,
      data: result.data,
      warnings: result.warnings,
      message: result.errorMessage,
    };
  } catch (error) {
    return { success: false, ...mapKnownError(error) };
  }
}

export async function generateOutreachAction(
  _prev: AIActionResult<OutreachMessage>,
  formData: FormData,
): Promise<AIActionResult<OutreachMessage>> {
  const leadId = formData.get("leadId");
  const channel = formData.get("channel");
  if (typeof leadId !== "string" || leadId.length === 0) {
    return { success: false, message: "Lead inválido." };
  }
  const validChannels: OutreachChannel[] = ["email", "whatsapp", "phone_script", "linkedin"];
  const resolvedChannel = validChannels.includes(channel as OutreachChannel)
    ? (channel as OutreachChannel)
    : "email";

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const result = await generateOutreachMessage(supabase, organizationId, leadId, resolvedChannel);
    revalidatePath(`/leads/${leadId}`);
    return {
      success: result.status === "completed",
      status: result.status,
      data: result.data,
      warnings: result.warnings,
      message: result.errorMessage,
    };
  } catch (error) {
    return { success: false, ...mapKnownError(error) };
  }
}

export async function generateSalesInsightsAction(
  _prev: AIActionResult<SalesInsights>,
  formData: FormData,
): Promise<AIActionResult<SalesInsights>> {
  const preset = formData.get("period");
  const validPresets: PeriodPreset[] = ["last_30_days", "current_month", "last_90_days"];
  const resolvedPreset = validPresets.includes(preset as PeriodPreset) ? (preset as PeriodPreset) : "last_30_days";

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const result = await generateSalesInsights(supabase, organizationId, resolvedPreset);
    revalidatePath("/dashboard");
    return {
      success: result.status === "completed",
      status: result.status,
      data: result.data,
      warnings: result.warnings,
      message: result.errorMessage,
    };
  } catch (error) {
    return { success: false, ...mapKnownError(error) };
  }
}

export async function generateProposalDraftAction(
  _prev: AIActionResult<ProposalDraft>,
  formData: FormData,
): Promise<AIActionResult<ProposalDraft>> {
  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || leadId.length === 0) {
    return { success: false, message: "Lead inválido." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const result = await generateProposalDraft(supabase, organizationId, leadId);
    revalidatePath(`/leads/${leadId}`);
    return {
      success: result.status === "completed",
      status: result.status,
      data: result.data,
      warnings: result.warnings,
      message: result.errorMessage,
    };
  } catch (error) {
    return { success: false, ...mapKnownError(error) };
  }
}
