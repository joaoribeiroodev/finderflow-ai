"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit/audit-log";
import { logger } from "@/lib/logger/logger";
import { assertCanEditOrganization } from "@/lib/permissions/permissions";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import { CompanyNotFoundForScoringError, recomputeDigitalPresenceScore } from "./digital-presence-score.service";

export interface RecomputeScoreResult {
  success: boolean;
  message?: string;
  score?: number;
}

/**
 * Ação manual de "Recalcular pontuação" na página da empresa — útil
 * para empresas com dados de contato anteriores ao Módulo 1 existir
 * (nunca passaram por um aceite de enriquecimento, então nunca tiveram
 * um score calculado).
 */
export async function recomputeDigitalPresenceScoreAction(
  _prev: RecomputeScoreResult,
  formData: FormData,
): Promise<RecomputeScoreResult> {
  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId) return { success: false, message: "Empresa inválida." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const result = await recomputeDigitalPresenceScore(supabase, organizationId, companyId);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    await logAudit({
      organizationId,
      actorId: user?.id ?? null,
      action: "digital_presence_score.recompute",
      resourceType: "companies",
      resourceId: companyId,
      metadata: { score: result.score },
    });

    revalidatePath(`/companies/${companyId}`);
    return { success: true, score: result.score };
  } catch (error) {
    if (error instanceof CompanyNotFoundForScoringError) {
      return { success: false, message: error.message };
    }
    logger.error("Falha ao recalcular pontuação de presença digital", {
      error: (error as Error).message,
      companyId,
    });
    return { success: false, message: "Não foi possível recalcular a pontuação agora." };
  }
}
