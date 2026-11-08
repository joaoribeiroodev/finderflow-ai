"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit/audit-log";
import { logger } from "@/lib/logger/logger";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { checkDistributedRateLimit } from "@/lib/security/distributed-rate-limit";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import {
  CompanyNotFoundForAuditError,
  CompanyWithoutWebsiteError,
  PageSpeedNotConfiguredError,
  runWebsiteAudit,
} from "./website-audit.service";

export interface RunWebsiteAuditResult {
  success: boolean;
  message?: string;
  performanceScore?: number | null;
}

// Risco #5 da auditoria (ETAPA-0-AUDITORIA.md seção 5): sem limite real
// por organização, um uso descontrolado da PageSpeed API pode esgotar a
// cota diária gratuita (25k/dia por chave). 20 auditorias/hora por
// organização é generoso para uso manual, mas corta um loop acidental.
const RATE_LIMIT_PER_ORG = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Ação "Rodar auditoria" na página da empresa (Módulo 2). Síncrona —
 * ver comentário em `website-audit.service.ts` sobre por que não passa
 * pela fila assíncrona da Fase 10 nesta primeira versão.
 */
export async function runWebsiteAuditAction(
  _prev: RunWebsiteAuditResult,
  formData: FormData,
): Promise<RunWebsiteAuditResult> {
  const companyId = String(formData.get("companyId") ?? "").trim();
  if (!companyId) return { success: false, message: "Empresa inválida." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    throw error;
  }

  const rateLimit = await checkDistributedRateLimit(
    `website_audit:${organizationId}`,
    RATE_LIMIT_PER_ORG,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    return {
      success: false,
      message: "Limite de auditorias de site por hora atingido para esta organização. Tente novamente mais tarde.",
    };
  }

  try {
    const result = await runWebsiteAudit(supabase, organizationId, companyId);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    await logAudit({
      organizationId,
      actorId: user?.id ?? null,
      action: "website_audit.run",
      resourceType: "companies",
      resourceId: companyId,
      metadata: { status: result.status, performanceScore: result.performanceScore },
    });

    revalidatePath(`/companies/${companyId}`);

    if (result.status === "failed") {
      return { success: false, message: result.errorMessage ?? "Falha ao rodar a auditoria de site." };
    }
    return { success: true, performanceScore: result.performanceScore };
  } catch (error) {
    if (
      error instanceof CompanyNotFoundForAuditError ||
      error instanceof CompanyWithoutWebsiteError ||
      error instanceof PageSpeedNotConfiguredError
    ) {
      return { success: false, message: error.message };
    }
    logger.error("Falha inesperada ao rodar auditoria de site", {
      error: (error as Error).message,
      companyId,
    });
    return { success: false, message: "Não foi possível rodar a auditoria agora." };
  }
}
