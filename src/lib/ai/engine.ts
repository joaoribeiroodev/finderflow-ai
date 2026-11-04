import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

import { getAIProvider } from "./openai-provider";
import { estimateCostUsd } from "./pricing";
import type { AIResult, AIResultStatus, ConversationInput, ConversationResult, StructuredAIInput } from "./provider";
import { assertWithinQuota } from "./quota";

type Supabase = SupabaseClient<Database>;

export class AIValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIValidationError";
  }
}

/**
 * `AIEngine` (Fase 5, item 2 do prompt mestre) é o único ponto de
 * entrada que os módulos de negócio (Company Analyzer, Lead Scorer,
 * Outreach Generator) devem usar para chamar IA — nunca o
 * `AIProvider`/SDK diretamente. Garante, nesta ordem:
 *
 * 1. Verificação de quota *antes* de chamar o provedor (nunca depois).
 * 2. Chamada ao provedor via `AIProvider.generateStructured`.
 * 3. Revalidação da saída com o MESMO schema Zod usado para gerar o
 *    Structured Output — o SDK confia no `output_parsed`, nós não
 *    confiamos cegamente nele (defesa em profundidade: um provedor
 *    "strict" ainda pode, em teoria, devolver algo fora do schema em
 *    casos extremos, e um bug de serialização não deve virar dado
 *    corrompido salvo como se fosse válido).
 * 4. Registro em `ai_usage_events` (modelo, prompt_version, tokens,
 *    custo estimado, duração, status) — sempre, mesmo em erro/recusa.
 */
export async function runStructuredAI<T>(
  supabase: Supabase,
  organizationId: string,
  input: StructuredAIInput<T>,
): Promise<AIResult<T>> {
  await assertWithinQuota(supabase, organizationId);

  const provider = getAIProvider();
  const result = await provider.generateStructured(input);

  let finalStatus: AIResultStatus = result.status;
  let finalData = result.data;
  let errorMessage = result.errorMessage;

  if (finalStatus === "completed" && finalData !== null) {
    const revalidated = input.schema.safeParse(finalData);
    if (!revalidated.success) {
      logger.error("Saída da IA não passou na revalidação Zod", {
        organizationId,
        promptKey: input.promptKey,
        issues: revalidated.error.issues,
      });
      finalStatus = "failed";
      finalData = null;
      errorMessage = "A resposta da IA não teve o formato esperado.";
    } else {
      finalData = revalidated.data;
    }
  }

  const estimatedCost = estimateCostUsd(result.model, result.usage.inputTokens, result.usage.outputTokens);

  const { error: logError } = await supabase.rpc("log_ai_usage", {
    p_organization_id: organizationId,
    p_model: result.model,
    p_operation: input.promptKey,
    p_prompt_version: input.promptVersion,
    p_input_tokens: result.usage.inputTokens,
    p_output_tokens: result.usage.outputTokens,
    p_estimated_cost: estimatedCost,
    p_duration_ms: result.durationMs,
    p_status: finalStatus,
  });

  if (logError) {
    // Falha ao registrar telemetria não deve impedir o usuário de receber
    // o resultado já obtido — mas é logada com severidade para investigação,
    // já que telemetria de custo/quota depende disso.
    logger.error("Falha ao registrar uso de IA", { error: logError.message, organizationId });
  }

  return { ...result, data: finalData, status: finalStatus, errorMessage };
}

/**
 * Equivalente a `runStructuredAI`, mas para o Copilot (`AIProvider.respond`):
 * mesma verificação de quota antes de chamar o provedor, e mesmo
 * registro em `ai_usage_events` (operação fixa "copilot") depois. Não há
 * revalidação com Zod aqui porque a resposta do Copilot é texto livre +
 * chamadas de ferramenta — cada ferramenta já valida seus próprios
 * argumentos (`src/lib/ai/copilot-tools.ts`).
 */
export async function runConversationTurn(
  supabase: Supabase,
  organizationId: string,
  input: ConversationInput,
): Promise<ConversationResult> {
  await assertWithinQuota(supabase, organizationId);

  const provider = getAIProvider();
  const result = await provider.respond(input);

  const estimatedCost = estimateCostUsd(result.model, result.usage.inputTokens, result.usage.outputTokens);

  const { error: logError } = await supabase.rpc("log_ai_usage", {
    p_organization_id: organizationId,
    p_model: result.model,
    p_operation: "copilot",
    p_prompt_version: input.promptVersion,
    p_input_tokens: result.usage.inputTokens,
    p_output_tokens: result.usage.outputTokens,
    p_estimated_cost: estimatedCost,
    p_duration_ms: result.durationMs,
    p_status: result.status,
  });

  if (logError) {
    logger.error("Falha ao registrar uso de IA (copilot)", { error: logError.message, organizationId });
  }

  return result;
}
