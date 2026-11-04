import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { StageCreateInput, StageUpdateInput } from "@/lib/validation/pipeline";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;
export type PipelineStageRow = Database["public"]["Tables"]["pipeline_stages"]["Row"];

/** Lista as etapas do funil da organização, já ordenadas para exibição. */
export async function listPipelineStages(
  supabase: Supabase,
  organizationId: string,
): Promise<PipelineStageRow[]> {
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("organization_id", organizationId)
    .order("position", { ascending: true });

  if (error) {
    logger.error("Falha ao listar etapas do pipeline", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar as etapas do pipeline.");
  }

  return data ?? [];
}

export class StageNameTakenError extends Error {
  constructor() {
    super("Já existe uma etapa com este nome.");
    this.name = "StageNameTakenError";
  }
}

export async function createStage(
  supabase: Supabase,
  organizationId: string,
  input: StageCreateInput,
): Promise<PipelineStageRow> {
  const { data: last } = await supabase
    .from("pipeline_stages")
    .select("position")
    .eq("organization_id", organizationId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({
      organization_id: organizationId,
      name: input.name,
      color: input.color,
      position: nextPosition,
      is_closed: input.resultType !== null,
      result_type: input.resultType,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw new StageNameTakenError();
    logger.error("Falha ao criar etapa do pipeline", { error: error.message, organizationId });
    throw new Error("Não foi possível criar a etapa.");
  }

  return data;
}

export async function updateStage(
  supabase: Supabase,
  organizationId: string,
  input: StageUpdateInput,
): Promise<PipelineStageRow> {
  const { data, error } = await supabase
    .from("pipeline_stages")
    .update({
      name: input.name,
      color: input.color,
      is_closed: input.resultType !== null,
      result_type: input.resultType,
    })
    .eq("organization_id", organizationId)
    .eq("id", input.stageId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw new StageNameTakenError();
    logger.error("Falha ao atualizar etapa do pipeline", {
      error: error.message,
      organizationId,
      stageId: input.stageId,
    });
    throw new Error("Não foi possível atualizar a etapa.");
  }

  return data;
}

export class StageHasLeadsError extends Error {
  constructor() {
    super("Esta etapa tem leads associados e não pode ser excluída. Mova os leads antes.");
    this.name = "StageHasLeadsError";
  }
}

/**
 * Exclui uma etapa. A própria constraint de FK em `leads.stage_id`
 * (sem `on delete cascade`, portanto `RESTRICT` por padrão) impede a
 * exclusão enquanto existirem leads — inclusive arquivados — apontando
 * para ela; aqui só traduzimos o erro de FK (`23503`) numa mensagem
 * amigável em vez de deixar a regra implícita no banco virar um 500 genérico.
 */
export async function deleteStage(
  supabase: Supabase,
  organizationId: string,
  stageId: string,
): Promise<void> {
  const { error } = await supabase
    .from("pipeline_stages")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", stageId);

  if (error) {
    if (error.code === "23503") throw new StageHasLeadsError();
    logger.error("Falha ao excluir etapa do pipeline", {
      error: error.message,
      organizationId,
      stageId,
    });
    throw new Error("Não foi possível excluir a etapa.");
  }
}

/**
 * Move uma etapa uma posição para cima/baixo. A ordem final é sempre
 * recalculada no servidor a partir do estado atual no banco (nunca a
 * partir de uma lista enviada pelo cliente) e aplicada atomicamente via
 * RPC `reorder_pipeline_stages` — ver docs/DECISIONS.md.
 */
export async function moveStage(
  supabase: Supabase,
  organizationId: string,
  stageId: string,
  direction: "up" | "down",
): Promise<void> {
  const stages = await listPipelineStages(supabase, organizationId);
  const index = stages.findIndex((s) => s.id === stageId);
  if (index === -1) throw new Error("Etapa não encontrada.");

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= stages.length) return; // já está na ponta, no-op

  const orderedIds = stages.map((s) => s.id);
  [orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];

  const { error } = await supabase.rpc("reorder_pipeline_stages", {
    p_organization_id: organizationId,
    p_ordered_ids: orderedIds,
  });

  if (error) {
    logger.error("Falha ao reordenar etapas do pipeline", { error: error.message, organizationId });
    throw new Error("Não foi possível reordenar as etapas.");
  }
}
