import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runStructuredAI } from "@/lib/ai/engine";
import type { AIResult } from "@/lib/ai/provider";
import { companyAnalysisSchema, type CompanyAnalysis } from "@/lib/ai/schemas";
import { logger } from "@/lib/logger/logger";
import { getCompanyById } from "@/modules/companies/companies.service";
import type { Database } from "@/types/database";

import { buildCompanyAnalyzerInput, COMPANY_ANALYZER_INSTRUCTIONS, PROMPT_KEYS, PROMPT_VERSIONS } from "./prompts";

type Supabase = SupabaseClient<Database>;

export class CompanyNotFoundError extends Error {
  constructor() {
    super("Empresa não encontrada.");
    this.name = "CompanyNotFoundError";
  }
}

/**
 * Executa o Company Analyzer para uma empresa e, se a chamada terminar
 * com sucesso (`status === "completed"`), persiste o resultado em
 * `ai_analyses`. Em qualquer outro status (recusa/incompleta/falha/cota
 * esgotada), nada é persistido — a UI mostra o estado honestamente a
 * partir do `AIResult` retornado.
 */
export async function analyzeCompany(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<AIResult<CompanyAnalysis>> {
  const company = await getCompanyById(supabase, organizationId, companyId);
  if (!company) throw new CompanyNotFoundError();

  const { data: services } = await supabase
    .from("services")
    .select("id, name, description")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  const result = await runStructuredAI(supabase, organizationId, {
    promptKey: PROMPT_KEYS.companyAnalyzer,
    promptVersion: PROMPT_VERSIONS.companyAnalyzer,
    instructions: COMPANY_ANALYZER_INSTRUCTIONS,
    input: buildCompanyAnalyzerInput(company, services ?? []),
    schema: companyAnalysisSchema,
    schemaName: "company_analysis",
  });

  if (result.status === "completed" && result.data) {
    const { error } = await supabase.from("ai_analyses").insert({
      organization_id: organizationId,
      company_id: companyId,
      analysis_type: "company_analysis",
      result: result.data,
      score: result.data.score,
      sources: result.sources,
      model: result.model,
      prompt_version: result.promptVersion,
    });

    if (error) {
      logger.error("Falha ao persistir análise de empresa", {
        error: error.message,
        organizationId,
        companyId,
      });
    }
  }

  return result;
}

export type CompanyAnalysisRow = Database["public"]["Tables"]["ai_analyses"]["Row"];

export async function listCompanyAnalyses(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<CompanyAnalysisRow[]> {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .eq("analysis_type", "company_analysis")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar análises de empresa", { error: error.message, organizationId, companyId });
    throw new Error("Não foi possível carregar as análises desta empresa.");
  }

  return data ?? [];
}
