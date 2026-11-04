import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type PlanRow = Database["public"]["Tables"]["plans"]["Row"];

/** Catálogo de planos ativos — RLS (`plans_read_active`) já restringe a `is_active = true`. */
export async function listActivePlans(supabase: Supabase): Promise<PlanRow[]> {
  const { data, error } = await supabase.from("plans").select("*").order("price", { ascending: true });

  if (error) {
    logger.error("Falha ao listar planos", { error: error.message });
    throw new Error("Não foi possível carregar os planos disponíveis.");
  }

  return data ?? [];
}

export async function getPlanById(supabase: Supabase, planId: string): Promise<PlanRow | null> {
  const { data, error } = await supabase.from("plans").select("*").eq("id", planId).maybeSingle();

  if (error) {
    logger.error("Falha ao buscar plano", { error: error.message, planId });
    throw new Error("Não foi possível carregar o plano selecionado.");
  }

  return data;
}
