"use server";

import { revalidatePath } from "next/cache";

import { logAudit } from "@/lib/audit/audit-log";
import { enqueueJob } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger/logger";
import { assertCanEditOrganization } from "@/lib/permissions/permissions";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import {
  CompanyNotFoundForEnrichmentError,
  enrichCompany,
  reviewEnrichmentField,
} from "./enrichment.service";

export interface EnrichmentActionResult {
  success: boolean;
  message?: string;
  proposedCount?: number;
}

/** Ação síncrona de "Enriquecer" na página de detalhe da empresa — um scan, uma empresa. */
export async function enrichCompanyAction(
  _prev: EnrichmentActionResult,
  formData: FormData,
): Promise<EnrichmentActionResult> {
  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId) return { success: false, message: "Empresa inválida." };

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const outcome = await enrichCompany(supabase, organizationId, companyId);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    await logAudit({
      organizationId,
      actorId: user?.id ?? null,
      action: "company_enrichment.scan",
      resourceType: "companies",
      resourceId: companyId,
      metadata: { status: outcome.status, proposedCount: outcome.proposedCount },
    });

    revalidatePath(`/companies/${companyId}`);

    if (outcome.status === "no_website") {
      return {
        success: true,
        proposedCount: 0,
        message: "Nenhum site identificado para esta empresa — nada para analisar.",
      };
    }
    if (outcome.status === "fetch_failed") {
      return {
        success: false,
        message: "Não foi possível acessar o site desta empresa agora. Tente novamente mais tarde.",
      };
    }
    return {
      success: true,
      proposedCount: outcome.proposedCount,
      message:
        outcome.proposedCount > 0
          ? `${outcome.proposedCount} campo${outcome.proposedCount === 1 ? "" : "s"} encontrado${
              outcome.proposedCount === 1 ? "" : "s"
            } para revisão.`
          : "Site analisado — nenhum campo novo encontrado.",
    };
  } catch (error) {
    if (error instanceof CompanyNotFoundForEnrichmentError) {
      return { success: false, message: error.message };
    }
    logger.error("Falha ao enriquecer empresa", { error: (error as Error).message, companyId });
    return { success: false, message: "Não foi possível enriquecer esta empresa agora." };
  }
}

/** Aceita/rejeita uma proposta de campo. Form simples (sem useActionState) — mesmo padrão de `removeSuppressionEntryAction`. */
export async function reviewEnrichmentFieldAction(formData: FormData): Promise<void> {
  const fieldId = String(formData.get("fieldId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  if (!fieldId || (decision !== "accepted" && decision !== "rejected") || !companyId) return;

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await reviewEnrichmentField(supabase, organizationId, fieldId, decision, user?.id ?? null);
    if (result) {
      await logAudit({
        organizationId,
        actorId: user?.id ?? null,
        action: decision === "accepted" ? "company_enrichment_field.accept" : "company_enrichment_field.reject",
        resourceType: "company_enrichment_fields",
        resourceId: fieldId,
        metadata: { fieldKey: result.fieldKey },
      });
    }
  } catch (error) {
    logger.error("Falha ao revisar campo de enriquecimento", {
      error: (error as Error).message,
      fieldId,
      decision,
    });
  }

  revalidatePath(`/companies/${companyId}`);
}

export interface BatchEnrichmentResult {
  success: boolean;
  message?: string;
  enqueuedCount?: number;
}

const MAX_BATCH_CANDIDATES = 500;

/**
 * Enfileira um job `enrich_company` por empresa pendente (sem website,
 * e-mail nem telefone cadastrados) — botão "Enriquecer empresas
 * pendentes" na listagem. É o primeiro uso real (não só manutenção) da
 * fila assíncrona da Fase 10. `idempotencyKey` por dia evita duplicar o
 * mesmo job se alguém clicar duas vezes no mesmo dia, mas ainda permite
 * tentar de novo em dias seguintes (a unique constraint de
 * `jobs.idempotency_key` é para sempre, não só enquanto pendente).
 */
export async function enqueueBatchEnrichmentAction(): Promise<BatchEnrichmentResult> {
  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);

    const { data: candidates, error } = await supabase
      .from("companies")
      .select("id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .is("website", null)
      .is("email", null)
      .is("phone", null)
      .limit(MAX_BATCH_CANDIDATES);

    if (error) throw new Error(error.message);

    if (!candidates || candidates.length === 0) {
      return { success: true, enqueuedCount: 0, message: "Nenhuma empresa pendente de enriquecimento." };
    }

    const daySlot = new Date().toISOString().slice(0, 10);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let enqueuedCount = 0;
    for (const company of candidates) {
      const result = await enqueueJob({
        jobType: "enrich_company",
        organizationId,
        payload: { companyId: company.id },
        idempotencyKey: `enrich_company:${company.id}:${daySlot}`,
      });
      if (result) enqueuedCount += 1;
    }

    await logAudit({
      organizationId,
      actorId: user?.id ?? null,
      action: "company_enrichment.batch_enqueue",
      resourceType: "companies",
      metadata: { candidateCount: candidates.length, enqueuedCount },
    });

    revalidatePath("/companies");
    return {
      success: true,
      enqueuedCount,
      message: `${enqueuedCount} empresa${enqueuedCount === 1 ? "" : "s"} enfileirada${
        enqueuedCount === 1 ? "" : "s"
      } para enriquecimento em lote.`,
    };
  } catch (error) {
    logger.error("Falha ao enfileirar enriquecimento em lote", {
      error: (error as Error).message,
      organizationId,
    });
    return { success: false, message: "Não foi possível enfileirar o enriquecimento em lote." };
  }
}
