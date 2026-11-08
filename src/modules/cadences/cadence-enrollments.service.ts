import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

import { computeStepRunAt } from "./cadence-compose";
import { listCadenceSteps } from "./cadences.service";

type Supabase = SupabaseClient<Database>;

export type CadenceEnrollmentStatus = "active" | "paused" | "stopped" | "completed";

export interface CadenceEnrollmentRow {
  id: string;
  cadenceId: string;
  cadenceName: string;
  leadId: string;
  status: CadenceEnrollmentStatus;
  currentStepOrder: number;
  nextRunAt: string;
  stoppedReason: string | null;
  startedAt: string;
}

export class AlreadyEnrolledError extends Error {
  constructor() {
    super("Este lead já está inscrito nesta cadência.");
    this.name = "AlreadyEnrolledError";
  }
}

export class CadenceHasNoStepsError extends Error {
  constructor() {
    super("Esta cadência ainda não tem nenhuma etapa configurada.");
    this.name = "CadenceHasNoStepsError";
  }
}

/**
 * Inscreve um lead em uma cadência. `next_run_at` da primeira etapa é
 * calculado já na inscrição (started_at + day_offset da etapa 1) — se o
 * `day_offset` da primeira etapa for 0, o worker periódico já pega na
 * próxima execução, não instantaneamente (mesma cadência de todo job
 * periódico desta fase).
 */
export async function enrollLeadInCadence(
  supabase: Supabase,
  organizationId: string,
  cadenceId: string,
  leadId: string,
): Promise<CadenceEnrollmentRow> {
  const steps = await listCadenceSteps(supabase, organizationId, cadenceId);
  if (steps.length === 0) throw new CadenceHasNoStepsError();

  const startedAt = new Date();
  const firstStep = steps[0]!;
  const nextRunAt = computeStepRunAt(startedAt, firstStep.dayOffset);

  const { data, error } = await supabase
    .from("cadence_enrollments")
    .insert({
      organization_id: organizationId,
      cadence_id: cadenceId,
      lead_id: leadId,
      status: "active",
      current_step_order: 0,
      next_run_at: nextRunAt.toISOString(),
      started_at: startedAt.toISOString(),
    })
    .select("id, cadence_id, lead_id, status, current_step_order, next_run_at, stopped_reason, started_at, cadence:cadences!cadence_enrollments_cadence_same_org_fk(name)")
    .single();

  if (error) {
    if (error.code === "23505") throw new AlreadyEnrolledError();
    logger.error("Falha ao inscrever lead em cadência", { error: error.message, organizationId, cadenceId, leadId });
    throw new Error("Não foi possível inscrever o lead nesta cadência.");
  }

  return mapEnrollmentRow(data);
}

function mapEnrollmentRow(data: {
  id: string;
  cadence_id: string;
  lead_id: string;
  status: string;
  current_step_order: number;
  next_run_at: string;
  stopped_reason: string | null;
  started_at: string;
  cadence: { name: string } | { name: string }[] | null;
}): CadenceEnrollmentRow {
  const cadence = Array.isArray(data.cadence) ? data.cadence[0] : data.cadence;
  return {
    id: data.id,
    cadenceId: data.cadence_id,
    cadenceName: cadence?.name ?? "Cadência removida",
    leadId: data.lead_id,
    status: data.status as CadenceEnrollmentStatus,
    currentStepOrder: data.current_step_order,
    nextRunAt: data.next_run_at,
    stoppedReason: data.stopped_reason,
    startedAt: data.started_at,
  };
}

export async function listEnrollmentsForLead(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<CadenceEnrollmentRow[]> {
  const { data, error } = await supabase
    .from("cadence_enrollments")
    .select(
      "id, cadence_id, lead_id, status, current_step_order, next_run_at, stopped_reason, started_at, cadence:cadences!cadence_enrollments_cadence_same_org_fk(name)",
    )
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("started_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar inscrições de cadência do lead", { error: error.message, organizationId, leadId });
    throw new Error("Não foi possível carregar as cadências deste lead.");
  }

  return (data ?? []).map(mapEnrollmentRow);
}

async function updateEnrollmentStatus(
  supabase: Supabase,
  organizationId: string,
  enrollmentId: string,
  status: CadenceEnrollmentStatus,
  stoppedReason: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("cadence_enrollments")
    .update({
      status,
      stopped_reason: stoppedReason,
      stopped_at: status === "stopped" ? new Date().toISOString() : null,
    })
    .eq("organization_id", organizationId)
    .eq("id", enrollmentId);

  if (error) {
    logger.error("Falha ao atualizar status da inscrição de cadência", {
      error: error.message,
      organizationId,
      enrollmentId,
      status,
    });
    throw new Error("Não foi possível atualizar esta inscrição.");
  }
}

export async function pauseCadenceEnrollment(supabase: Supabase, organizationId: string, enrollmentId: string) {
  return updateEnrollmentStatus(supabase, organizationId, enrollmentId, "paused", null);
}

export async function resumeCadenceEnrollment(supabase: Supabase, organizationId: string, enrollmentId: string) {
  return updateEnrollmentStatus(supabase, organizationId, enrollmentId, "active", null);
}

/**
 * Parada manual — usada pelo botão "Marcar como respondeu" (condição de
 * parada explícita pedida na seção 9 da auditoria, "resposta manual"),
 * mas serve para qualquer motivo manual.
 */
export async function stopCadenceEnrollment(
  supabase: Supabase,
  organizationId: string,
  enrollmentId: string,
  reason: string,
) {
  return updateEnrollmentStatus(supabase, organizationId, enrollmentId, "stopped", reason);
}
