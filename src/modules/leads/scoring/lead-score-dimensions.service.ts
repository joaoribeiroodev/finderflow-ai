import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LeadScoreResult } from "@/lib/ai/schemas";
import { logger } from "@/lib/logger/logger";
import type { Database, Json } from "@/types/database";

import { computeLeadScoreDimensions, LEAD_SCORE_DIMENSIONS } from "./lead-score-dimensions";

type Supabase = SupabaseClient<Database>;

export interface LeadScoreDimensionsRow {
  id: string;
  potentialScore: number;
  fitScore: number;
  priorityScore: number;
  model: string;
  promptVersion: string;
  computedAt: string;
}

/**
 * Grava uma nova linha de histórico com as 3 dimensões derivadas do
 * `score_breakdown` já retornado pelo Lead Scorer. Chamado
 * automaticamente por `scoreLead()` depois de cada qualificação bem
 * sucedida — nunca gasta uma chamada de IA própria.
 */
export async function recordLeadScoreDimensions(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
  breakdown: LeadScoreResult["score_breakdown"],
  model: string,
  promptVersion: string,
): Promise<LeadScoreDimensionsRow> {
  const dimensions = computeLeadScoreDimensions(breakdown);

  const { data, error } = await supabase
    .from("lead_scores")
    .insert({
      organization_id: organizationId,
      lead_id: leadId,
      potential_score: dimensions.potentialScore,
      fit_score: dimensions.fitScore,
      priority_score: dimensions.priorityScore,
      weights: LEAD_SCORE_DIMENSIONS as unknown as Json,
      model,
      prompt_version: promptVersion,
    })
    .select("id, potential_score, fit_score, priority_score, model, prompt_version, computed_at")
    .single();

  if (error || !data) {
    logger.error("Falha ao gravar dimensões do Lead Scoring 2.0", {
      error: error?.message,
      organizationId,
      leadId,
    });
    throw new Error("Não foi possível gravar as dimensões de qualificação do lead.");
  }

  return {
    id: data.id,
    potentialScore: data.potential_score,
    fitScore: data.fit_score,
    priorityScore: data.priority_score,
    model: data.model,
    promptVersion: data.prompt_version,
    computedAt: data.computed_at,
  };
}

/** Última decomposição em dimensões calculada para o lead, ou `null` se nunca foi calculada. */
export async function getLatestLeadScoreDimensions(
  supabase: Supabase,
  organizationId: string,
  leadId: string,
): Promise<LeadScoreDimensionsRow | null> {
  const { data, error } = await supabase
    .from("lead_scores")
    .select("id, potential_score, fit_score, priority_score, model, prompt_version, computed_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao buscar dimensões do Lead Scoring 2.0", { error: error.message, organizationId, leadId });
    throw new Error("Não foi possível carregar as dimensões de qualificação do lead.");
  }
  if (!data) return null;

  return {
    id: data.id,
    potentialScore: data.potential_score,
    fitScore: data.fit_score,
    priorityScore: data.priority_score,
    model: data.model,
    promptVersion: data.prompt_version,
    computedAt: data.computed_at,
  };
}
