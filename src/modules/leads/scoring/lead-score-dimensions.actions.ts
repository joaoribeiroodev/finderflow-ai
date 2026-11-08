"use server";

import { revalidatePath } from "next/cache";

import type { LeadScoreResult } from "@/lib/ai/schemas";
import { logAudit } from "@/lib/audit/audit-log";
import { logger } from "@/lib/logger/logger";
import { assertCanEditOrganization } from "@/lib/permissions/permissions";
import { createClient } from "@/lib/supabase/server";
import { listLeadAnalyses } from "@/modules/ai/lead-scorer.service";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import { recordLeadScoreDimensions } from "./lead-score-dimensions.service";

export interface RecomputeDimensionsResult {
  success: boolean;
  message?: string;
}

/**
 * Recalcula as 3 dimensões a partir da última qualificação por IA já
 * existente (`ai_analyses`), sem gastar uma nova chamada de IA — útil
 * para leads qualificados antes do Módulo 4 existir, que nunca tiveram
 * uma linha em `lead_scores`.
 */
export async function recomputeLeadScoreDimensionsAction(
  _prev: RecomputeDimensionsResult,
  formData: FormData,
): Promise<RecomputeDimensionsResult> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) return { success: false, message: "Lead inválido." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);

    const analyses = await listLeadAnalyses(supabase, organizationId, leadId);
    const latestScoreAnalysis = analyses.find((a) => a.analysis_type === "lead_score");
    if (!latestScoreAnalysis) {
      return {
        success: false,
        message: "Este lead ainda não tem nenhuma qualificação por IA para decompor — qualifique primeiro.",
      };
    }

    const breakdown = (latestScoreAnalysis.result as unknown as LeadScoreResult).score_breakdown;
    await recordLeadScoreDimensions(
      supabase,
      organizationId,
      leadId,
      breakdown,
      latestScoreAnalysis.model,
      latestScoreAnalysis.prompt_version,
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    await logAudit({
      organizationId,
      actorId: user?.id ?? null,
      action: "lead_score_dimensions.recompute",
      resourceType: "leads",
      resourceId: leadId,
    });

    revalidatePath(`/leads/${leadId}`);
    return { success: true };
  } catch (error) {
    logger.error("Falha ao recalcular dimensões do Lead Scoring 2.0", {
      error: (error as Error).message,
      leadId,
    });
    return { success: false, message: "Não foi possível recalcular as dimensões agora." };
  }
}
