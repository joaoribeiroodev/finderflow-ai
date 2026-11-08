import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type CadenceStatus = "active" | "archived";

export interface CadenceRow {
  id: string;
  name: string;
  description: string | null;
  status: CadenceStatus;
  createdAt: string;
}

export interface CadenceListEntry extends CadenceRow {
  stepCount: number;
  activeEnrollmentCount: number;
}

export interface CadenceStepRow {
  id: string;
  stepOrder: number;
  dayOffset: number;
  subjectTemplate: string;
  bodyTemplate: string;
}

/**
 * Módulo 7 — Cadências e Follow-up. `cadences`/`cadence_steps`
 * (migration `module7_cadences`) — templates escritos por um humano,
 * nunca gerados por IA (ver cadence-compose.ts).
 */
export async function createCadence(
  supabase: Supabase,
  organizationId: string,
  input: { name: string; description: string | null },
  createdBy: string | null,
): Promise<CadenceRow> {
  const { data, error } = await supabase
    .from("cadences")
    .insert({
      organization_id: organizationId,
      name: input.name,
      description: input.description,
      created_by: createdBy,
    })
    .select("id, name, description, status, created_at")
    .single();

  if (error || !data) {
    logger.error("Falha ao criar cadência", { error: error?.message, organizationId });
    throw new Error("Não foi possível criar a cadência.");
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    status: data.status as CadenceStatus,
    createdAt: data.created_at,
  };
}

export async function listCadences(supabase: Supabase, organizationId: string): Promise<CadenceListEntry[]> {
  const { data: cadences, error } = await supabase
    .from("cadences")
    .select("id, name, description, status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar cadências", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar as cadências.");
  }
  if (!cadences || cadences.length === 0) return [];

  const [{ data: steps, error: stepsError }, { data: enrollments, error: enrollmentsError }] = await Promise.all([
    supabase.from("cadence_steps").select("cadence_id").eq("organization_id", organizationId),
    supabase
      .from("cadence_enrollments")
      .select("cadence_id, status")
      .eq("organization_id", organizationId)
      .eq("status", "active"),
  ]);

  if (stepsError || enrollmentsError) {
    logger.error("Falha ao agregar contadores de cadências", {
      error: stepsError?.message ?? enrollmentsError?.message,
      organizationId,
    });
    throw new Error("Não foi possível carregar as cadências.");
  }

  const stepCountByCadence = new Map<string, number>();
  for (const row of steps ?? []) {
    stepCountByCadence.set(row.cadence_id, (stepCountByCadence.get(row.cadence_id) ?? 0) + 1);
  }
  const activeEnrollmentCountByCadence = new Map<string, number>();
  for (const row of enrollments ?? []) {
    activeEnrollmentCountByCadence.set(row.cadence_id, (activeEnrollmentCountByCadence.get(row.cadence_id) ?? 0) + 1);
  }

  return cadences.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    status: c.status as CadenceStatus,
    createdAt: c.created_at,
    stepCount: stepCountByCadence.get(c.id) ?? 0,
    activeEnrollmentCount: activeEnrollmentCountByCadence.get(c.id) ?? 0,
  }));
}

export async function getCadenceById(
  supabase: Supabase,
  organizationId: string,
  cadenceId: string,
): Promise<CadenceRow | null> {
  const { data, error } = await supabase
    .from("cadences")
    .select("id, name, description, status, created_at")
    .eq("organization_id", organizationId)
    .eq("id", cadenceId)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao buscar cadência", { error: error.message, organizationId, cadenceId });
    throw new Error("Não foi possível carregar a cadência.");
  }
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    status: data.status as CadenceStatus,
    createdAt: data.created_at,
  };
}

export async function updateCadenceStatus(
  supabase: Supabase,
  organizationId: string,
  cadenceId: string,
  status: CadenceStatus,
): Promise<void> {
  const { error } = await supabase
    .from("cadences")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", cadenceId);

  if (error) {
    logger.error("Falha ao atualizar status da cadência", { error: error.message, organizationId, cadenceId });
    throw new Error("Não foi possível atualizar o status da cadência.");
  }
}

export async function listCadenceSteps(
  supabase: Supabase,
  organizationId: string,
  cadenceId: string,
): Promise<CadenceStepRow[]> {
  const { data, error } = await supabase
    .from("cadence_steps")
    .select("id, step_order, day_offset, subject_template, body_template")
    .eq("organization_id", organizationId)
    .eq("cadence_id", cadenceId)
    .order("step_order", { ascending: true });

  if (error) {
    logger.error("Falha ao listar etapas da cadência", { error: error.message, organizationId, cadenceId });
    throw new Error("Não foi possível carregar as etapas desta cadência.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    stepOrder: row.step_order,
    dayOffset: row.day_offset,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
  }));
}

export class DuplicateStepOrderError extends Error {
  constructor() {
    super("Já existe uma etapa com essa ordem nesta cadência.");
    this.name = "DuplicateStepOrderError";
  }
}

/** Adiciona uma etapa. `stepOrder` é escolhido pelo usuário (controla a ordem de execução), não autoincrementado. */
export async function addCadenceStep(
  supabase: Supabase,
  organizationId: string,
  cadenceId: string,
  input: { stepOrder: number; dayOffset: number; subjectTemplate: string; bodyTemplate: string },
): Promise<CadenceStepRow> {
  const { data, error } = await supabase
    .from("cadence_steps")
    .insert({
      organization_id: organizationId,
      cadence_id: cadenceId,
      step_order: input.stepOrder,
      day_offset: input.dayOffset,
      subject_template: input.subjectTemplate,
      body_template: input.bodyTemplate,
    })
    .select("id, step_order, day_offset, subject_template, body_template")
    .single();

  if (error) {
    if (error.code === "23505") throw new DuplicateStepOrderError();
    logger.error("Falha ao adicionar etapa da cadência", { error: error.message, organizationId, cadenceId });
    throw new Error("Não foi possível adicionar a etapa.");
  }

  return {
    id: data.id,
    stepOrder: data.step_order,
    dayOffset: data.day_offset,
    subjectTemplate: data.subject_template,
    bodyTemplate: data.body_template,
  };
}

export async function removeCadenceStep(
  supabase: Supabase,
  organizationId: string,
  stepId: string,
): Promise<void> {
  const { error } = await supabase
    .from("cadence_steps")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", stepId);

  if (error) {
    logger.error("Falha ao remover etapa da cadência", { error: error.message, organizationId, stepId });
    throw new Error("Não foi possível remover a etapa.");
  }
}
