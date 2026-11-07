import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runConversationTurn } from "@/lib/ai/engine";
import { copilotToolsAsConversationTools, getCopilotTool } from "@/lib/ai/copilot-tools";
import type { ConversationInput, ConversationToolCall } from "@/lib/ai/provider";
import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

import { COPILOT_INSTRUCTIONS, PROMPT_KEYS, PROMPT_VERSIONS } from "./prompts";

type Supabase = SupabaseClient<Database>;

export type ConversationRow = Database["public"]["Tables"]["ai_conversations"]["Row"];
export type MessageRow = Database["public"]["Tables"]["ai_messages"]["Row"];

export class ConversationNotFoundError extends Error {
  constructor() {
    super("Conversa não encontrada.");
    this.name = "ConversationNotFoundError";
  }
}

export class NoPendingToolCallError extends Error {
  constructor() {
    super("Não há nenhuma ação aguardando confirmação nesta conversa.");
    this.name = "NoPendingToolCallError";
  }
}

/** Formato persistido em `ai_conversations.pending_tool_call`. */
interface PendingToolCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
  description: string;
}

/** Resultado de um turno do Copilot, para a UI decidir o que renderizar. */
export type CopilotTurnResult =
  | { kind: "message"; text: string; warnings: string[] }
  | { kind: "pending_confirmation"; description: string }
  | { kind: "error"; message: string };

const MAX_TOOL_LOOP_ITERATIONS = 5;
const CONVERSATION_TITLE_MAX_LENGTH = 60;

/**
 * Deriva um título curto a partir da primeira mensagem do usuário —
 * `createConversation` nunca recebe título (o botão "Nova conversa" cria
 * a linha antes de haver qualquer mensagem), então sem isso toda
 * conversa ficava permanentemente como "Conversa sem título" na lista.
 * Corta em um limite de caracteres, preferindo uma quebra de palavra,
 * sem chamar a IA — é só um rótulo de navegação, não vale o custo/
 * latência de mais uma chamada estruturada.
 */
export function deriveConversationTitle(firstMessage: string): string {
  const normalized = firstMessage.replace(/\s+/g, " ").trim();
  if (normalized.length <= CONVERSATION_TITLE_MAX_LENGTH) return normalized;

  const truncated = normalized.slice(0, CONVERSATION_TITLE_MAX_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
  return `${base}…`;
}

export async function createConversation(
  supabase: Supabase,
  organizationId: string,
  userId: string,
  title?: string,
): Promise<ConversationRow> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ organization_id: organizationId, user_id: userId, title: title ?? null })
    .select("*")
    .single();

  if (error) {
    logger.error("Falha ao criar conversa do Copilot", { error: error.message, organizationId });
    throw new Error("Não foi possível iniciar a conversa.");
  }
  return data;
}

export async function listConversations(
  supabase: Supabase,
  organizationId: string,
  userId: string,
): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) {
    logger.error("Falha ao listar conversas do Copilot", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar as conversas.");
  }
  return data ?? [];
}

export async function getConversationWithMessages(
  supabase: Supabase,
  organizationId: string,
  conversationId: string,
): Promise<{ conversation: ConversationRow; messages: MessageRow[] } | null> {
  const { data: conversation, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao buscar conversa do Copilot", { error: error.message, organizationId, conversationId });
    throw new Error("Não foi possível carregar a conversa.");
  }
  if (!conversation) return null;

  const { data: messages } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return { conversation, messages: messages ?? [] };
}

async function insertMessage(
  supabase: Supabase,
  organizationId: string,
  conversationId: string,
  role: "user" | "assistant" | "tool",
  content: string | null,
  toolCalls: unknown[] | null,
): Promise<void> {
  const { error } = await supabase.from("ai_messages").insert({
    organization_id: organizationId,
    conversation_id: conversationId,
    role,
    content,
    tool_calls: toolCalls as Database["public"]["Tables"]["ai_messages"]["Insert"]["tool_calls"],
  });
  if (error) {
    logger.error("Falha ao persistir mensagem do Copilot", { error: error.message, organizationId, conversationId });
  }
}

async function setPendingToolCall(
  supabase: Supabase,
  organizationId: string,
  conversationId: string,
  pending: PendingToolCall | null,
  lastResponseId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("ai_conversations")
    .update({ pending_tool_call: pending as unknown as Database["public"]["Tables"]["ai_conversations"]["Update"]["pending_tool_call"], last_response_id: lastResponseId })
    .eq("organization_id", organizationId)
    .eq("id", conversationId);

  if (error) {
    logger.error("Falha ao atualizar estado da conversa do Copilot", {
      error: error.message,
      organizationId,
      conversationId,
    });
  }
}

/**
 * Executa um turno do Copilot a partir de um `ConversationInput` já
 * montado (nova mensagem do usuário, ou saída de uma ferramenta sendo
 * devolvida ao modelo), tratando o loop de chamadas de ferramenta. Ver
 * `CopilotTurnResult` para os estados possíveis.
 *
 * Limita a UMA chamada de ferramenta por turno (reforçado também na
 * instrução enviada ao modelo) — a Responses API exige que toda chamada
 * de função de um turno seja respondida antes de continuar a conversa
 * via `previous_response_id`, então múltiplas chamadas simultâneas, uma
 * delas mutante, criariam um estado impossível de confirmar
 * parcialmente. Se o modelo mesmo assim devolver mais de uma, abortamos
 * esse turno sem avançar `last_response_id`, para a próxima mensagem do
 * usuário retomar de um estado consistente.
 */
async function processTurn(
  supabase: Supabase,
  organizationId: string,
  userId: string,
  conversationId: string,
  input: ConversationInput,
): Promise<CopilotTurnResult> {
  const result = await runConversationTurn(supabase, organizationId, input);

  if (result.status !== "completed") {
    return { kind: "error", message: result.errorMessage ?? "Falha ao consultar a IA." };
  }

  if (result.toolCalls.length === 0) {
    await insertMessage(supabase, organizationId, conversationId, "assistant", result.text, null);
    await setPendingToolCall(supabase, organizationId, conversationId, null, result.responseId);
    return { kind: "message", text: result.text, warnings: result.warnings };
  }

  if (result.toolCalls.length > 1) {
    logger.error("Copilot retornou múltiplas chamadas de ferramenta em um turno", {
      organizationId,
      conversationId,
      count: result.toolCalls.length,
    });
    await insertMessage(
      supabase,
      organizationId,
      conversationId,
      "assistant",
      "(o assistente tentou várias ações ao mesmo tempo; tente reformular seu pedido em etapas menores)",
      null,
    );
    return {
      kind: "error",
      message: "O assistente tentou executar várias ações ao mesmo tempo. Tente pedir uma ação por vez.",
    };
  }

  const call: ConversationToolCall = result.toolCalls[0];
  const tool = getCopilotTool(call.name);

  if (!tool) {
    logger.error("Copilot chamou ferramenta fora da allowlist", { organizationId, conversationId, name: call.name });
    await setPendingToolCall(supabase, organizationId, conversationId, null, result.responseId);
    return { kind: "error", message: "O assistente tentou usar uma ferramenta não permitida." };
  }

  await insertMessage(supabase, organizationId, conversationId, "assistant", null, [
    { callId: call.callId, name: call.name, arguments: call.arguments },
  ]);

  if (tool.mutating) {
    const description = tool.describeForConfirmation?.(call.arguments) ?? `Executar ${tool.name}.`;
    await setPendingToolCall(
      supabase,
      organizationId,
      conversationId,
      { callId: call.callId, name: call.name, arguments: call.arguments, description },
      result.responseId,
    );
    return { kind: "pending_confirmation", description };
  }

  // Ferramenta somente leitura: executa imediatamente e continua o turno.
  let output: unknown;
  try {
    output = await tool.execute(supabase, organizationId, userId, call.arguments);
  } catch (error) {
    logger.error("Falha ao executar ferramenta do Copilot", {
      error: error instanceof Error ? error.message : String(error),
      organizationId,
      conversationId,
      tool: tool.name,
    });
    output = { error: "Falha ao executar a ferramenta." };
  }

  await insertMessage(supabase, organizationId, conversationId, "tool", JSON.stringify(output), [
    { callId: call.callId },
  ]);

  return continueAfterToolOutput(supabase, organizationId, userId, conversationId, call.callId, output, result.responseId, 1);
}

async function continueAfterToolOutput(
  supabase: Supabase,
  organizationId: string,
  userId: string,
  conversationId: string,
  toolCallId: string,
  output: unknown,
  previousResponseId: string | null,
  iteration: number,
): Promise<CopilotTurnResult> {
  if (iteration >= MAX_TOOL_LOOP_ITERATIONS) {
    return {
      kind: "error",
      message: "O assistente encadeou ações demais nesta solicitação. Tente um pedido mais específico.",
    };
  }

  const nextInput: ConversationInput = {
    promptKey: PROMPT_KEYS.copilot,
    promptVersion: PROMPT_VERSIONS.copilot,
    instructions: COPILOT_INSTRUCTIONS,
    messages: [{ role: "tool", content: JSON.stringify(output), toolCallId }],
    tools: copilotToolsAsConversationTools(),
    previousResponseId: previousResponseId ?? undefined,
  };

  return processTurn(supabase, organizationId, userId, conversationId, nextInput);
}

/** Envia uma nova mensagem do usuário na conversa. */
export async function sendCopilotMessage(
  supabase: Supabase,
  organizationId: string,
  userId: string,
  conversationId: string,
  text: string,
): Promise<CopilotTurnResult> {
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) throw new ConversationNotFoundError();
  if (conversation.pending_tool_call) {
    return {
      kind: "error",
      message: "Há uma ação aguardando sua confirmação. Confirme ou cancele antes de continuar.",
    };
  }

  await insertMessage(supabase, organizationId, conversationId, "user", text, null);

  if (!conversation.title) {
    const { error: titleError } = await supabase
      .from("ai_conversations")
      .update({ title: deriveConversationTitle(text) })
      .eq("organization_id", organizationId)
      .eq("id", conversationId);
    if (titleError) {
      logger.warn("Falha ao definir título da conversa do Copilot", {
        error: titleError.message,
        organizationId,
        conversationId,
      });
    }
  }

  const input: ConversationInput = {
    promptKey: PROMPT_KEYS.copilot,
    promptVersion: PROMPT_VERSIONS.copilot,
    instructions: COPILOT_INSTRUCTIONS,
    messages: [{ role: "user", content: text }],
    tools: copilotToolsAsConversationTools(),
    previousResponseId: conversation.last_response_id ?? undefined,
  };

  return processTurn(supabase, organizationId, userId, conversationId, input);
}

/**
 * Confirma a ação pendente: relê `pending_tool_call` do BANCO (nunca do
 * formulário enviado pelo cliente), executa a ferramenta, e devolve a
 * saída ao modelo para ele continuar a conversa.
 */
export async function confirmPendingToolCall(
  supabase: Supabase,
  organizationId: string,
  userId: string,
  conversationId: string,
): Promise<CopilotTurnResult> {
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) throw new ConversationNotFoundError();
  const pending = conversation.pending_tool_call as unknown as PendingToolCall | null;
  if (!pending) throw new NoPendingToolCallError();

  const tool = getCopilotTool(pending.name);
  if (!tool) {
    await setPendingToolCall(supabase, organizationId, conversationId, null, conversation.last_response_id);
    return { kind: "error", message: "Ferramenta não encontrada." };
  }

  await setPendingToolCall(supabase, organizationId, conversationId, null, conversation.last_response_id);

  let output: unknown;
  try {
    output = await tool.execute(supabase, organizationId, userId, pending.arguments);
  } catch (error) {
    logger.error("Falha ao executar ferramenta confirmada do Copilot", {
      error: error instanceof Error ? error.message : String(error),
      organizationId,
      conversationId,
      tool: tool.name,
    });
    output = { error: "Falha ao executar a ação." };
  }

  await insertMessage(supabase, organizationId, conversationId, "tool", JSON.stringify(output), [
    { callId: pending.callId },
  ]);

  return continueAfterToolOutput(
    supabase,
    organizationId,
    userId,
    conversationId,
    pending.callId,
    output,
    conversation.last_response_id,
    1,
  );
}

/** Cancela a ação pendente sem executá-la, avisando o modelo da recusa. */
export async function rejectPendingToolCall(
  supabase: Supabase,
  organizationId: string,
  userId: string,
  conversationId: string,
): Promise<CopilotTurnResult> {
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) throw new ConversationNotFoundError();
  const pending = conversation.pending_tool_call as unknown as PendingToolCall | null;
  if (!pending) throw new NoPendingToolCallError();

  await setPendingToolCall(supabase, organizationId, conversationId, null, conversation.last_response_id);

  const output = { rejected: true, reason: "O usuário não confirmou esta ação." };
  await insertMessage(supabase, organizationId, conversationId, "tool", JSON.stringify(output), [
    { callId: pending.callId },
  ]);

  return continueAfterToolOutput(
    supabase,
    organizationId,
    userId,
    conversationId,
    pending.callId,
    output,
    conversation.last_response_id,
    1,
  );
}
