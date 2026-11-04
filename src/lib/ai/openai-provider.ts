import "server-only";

import OpenAI from "openai";
import { zodResponsesFunction, zodTextFormat } from "openai/helpers/zod";
import type { ZodType } from "zod";

import { getServerEnv, isOpenAiConfigured } from "@/lib/env/env.server";

import type {
  AIProvider,
  AIResult,
  AIResultStatus,
  AIUsage,
  ConversationInput,
  ConversationResult,
  ConversationToolCall,
  StructuredAIInput,
} from "./provider";
import { AIProviderNotConfiguredError, NotConfiguredAIProvider } from "./provider";

/**
 * Implementação real do `AIProvider` sobre a Responses API da OpenAI
 * (docs/05-integrations.md §5.1 — API atual; nunca Assistants/Threads/Runs).
 *
 * Usa `client.responses.parse()` com `text.format` gerado por
 * `zodTextFormat` para obter Structured Outputs — a saída já vem
 * validada pelo SDK contra o JSON Schema gerado do Zod, e o chamador
 * (`src/lib/ai/engine.ts`, Fase 5 item 2) revalida com o mesmo schema
 * Zod antes de persistir, por segurança em profundidade (o SDK confia
 * no `response.output_parsed`; nós não confiamos cegamente nele).
 */
export class OpenAIProvider implements AIProvider {
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(apiKey: string, defaultModel: string) {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;
  }

  async generateStructured<T>(input: StructuredAIInput<T>): Promise<AIResult<T>> {
    const model = input.model ?? this.defaultModel;
    const startedAt = Date.now();

    try {
      const response = await this.client.responses.parse({
        model,
        instructions: input.instructions,
        input: input.input,
        text: { format: zodTextFormat(input.schema as unknown as ZodType, input.schemaName) },
      });

      const durationMs = Date.now() - startedAt;
      const status = mapResponseStatus(response.status, response.incomplete_details?.reason);
      const usage = mapUsage(response.usage);
      const warnings: string[] = [];

      if (response.incomplete_details?.reason) {
        warnings.push(`Resposta incompleta: ${response.incomplete_details.reason}`);
      }

      return {
        data: status === "completed" ? (response.output_parsed as T) : null,
        model: response.model ?? model,
        responseId: response.id ?? null,
        usage,
        durationMs,
        status,
        promptKey: input.promptKey,
        promptVersion: input.promptVersion,
        sources: [],
        warnings,
        errorMessage: status === "completed" ? undefined : incompleteMessage(status),
      };
    } catch (error) {
      return buildFailureResult(error, input, Date.now() - startedAt, model);
    }
  }

  async respond(input: ConversationInput): Promise<ConversationResult> {
    const model = input.model ?? this.defaultModel;
    const startedAt = Date.now();

    try {
      const response = await this.client.responses.create({
        model,
        instructions: input.instructions,
        input: input.messages.map((message) => toResponsesMessage(message)),
        tools: input.tools?.map((tool) =>
          zodResponsesFunction({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          }),
        ),
        previous_response_id: input.previousResponseId,
      });

      const durationMs = Date.now() - startedAt;
      const status = mapResponseStatus(response.status, response.incomplete_details?.reason);
      const usage = mapUsage(response.usage);
      const toolCalls: ConversationToolCall[] = [];

      for (const item of response.output) {
        if (item.type === "function_call") {
          let parsedArguments: Record<string, unknown> = {};
          try {
            parsedArguments = JSON.parse(item.arguments) as Record<string, unknown>;
          } catch {
            // Argumentos malformados do modelo: o chamador trata como objeto vazio
            // e a validação Zod da própria ferramenta (feita pelo executor) vai rejeitar.
          }
          toolCalls.push({ callId: item.call_id, name: item.name, arguments: parsedArguments });
        }
      }

      const warnings: string[] = [];
      if (response.incomplete_details?.reason) {
        warnings.push(`Resposta incompleta: ${response.incomplete_details.reason}`);
      }

      return {
        text: response.output_text ?? "",
        toolCalls,
        model: response.model ?? model,
        responseId: response.id ?? null,
        usage,
        durationMs,
        status,
        warnings,
        errorMessage: status === "completed" ? undefined : incompleteMessage(status),
      };
    } catch (error) {
      return buildConversationFailureResult(error, Date.now() - startedAt, model);
    }
  }
}

function toResponsesMessage(message: ConversationInput["messages"][number]) {
  if (message.role === "tool") {
    if (!message.toolCallId) {
      throw new Error("Mensagem de ferramenta sem toolCallId.");
    }
    return {
      type: "function_call_output" as const,
      call_id: message.toolCallId,
      output: message.content,
    };
  }
  return { role: message.role, content: message.content };
}

function mapUsage(usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null | undefined): AIUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

function mapResponseStatus(
  status: string | null | undefined,
  incompleteReason: string | null | undefined,
): AIResultStatus {
  if (status === "completed") return "completed";
  if (status === "incomplete") {
    if (incompleteReason === "content_filter") return "refused";
    return "incomplete";
  }
  // "failed", "cancelled", "queued", "in_progress" (inesperado após await) ou desconhecido.
  return "failed";
}

function incompleteMessage(status: AIResultStatus): string {
  switch (status) {
    case "refused":
      return "O modelo recusou gerar uma resposta para esta solicitação (filtro de conteúdo).";
    case "incomplete":
      return "A resposta do modelo foi cortada antes de terminar (limite de tokens ou de mensagens).";
    case "failed":
      return "A chamada à IA falhou.";
    default:
      return "";
  }
}

function buildFailureResult<T>(
  error: unknown,
  input: StructuredAIInput<T>,
  durationMs: number,
  model: string,
): AIResult<T> {
  const { status, message } = classifyError(error);
  return {
    data: null,
    model,
    responseId: null,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    durationMs,
    status,
    promptKey: input.promptKey,
    promptVersion: input.promptVersion,
    sources: [],
    warnings: [],
    errorMessage: message,
  };
}

function buildConversationFailureResult(
  error: unknown,
  durationMs: number,
  model: string,
): ConversationResult {
  const { status, message } = classifyError(error);
  return {
    text: "",
    toolCalls: [],
    model,
    responseId: null,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    durationMs,
    status,
    warnings: [],
    errorMessage: message,
  };
}

/**
 * Mapeia a hierarquia de erros do SDK (`openai/core/error`) para o status
 * que o resto do app entende, sem expor detalhes internos da API nas
 * mensagens voltadas ao usuário.
 */
function classifyError(error: unknown): { status: AIResultStatus; message: string } {
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return { status: "failed", message: "A IA não respondeu a tempo. Tente novamente." };
  }
  if (error instanceof OpenAI.RateLimitError) {
    return {
      status: "failed",
      message: "Limite de requisições à IA atingido. Tente novamente em alguns instantes.",
    };
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return {
      status: "failed",
      message: "Falha de autenticação com o provedor de IA. Verifique a configuração.",
    };
  }
  if (error instanceof OpenAI.APIError) {
    return { status: "failed", message: "O provedor de IA retornou um erro. Tente novamente." };
  }
  if (error instanceof Error) {
    return { status: "failed", message: "Falha inesperada ao chamar a IA." };
  }
  return { status: "failed", message: "Falha inesperada ao chamar a IA." };
}

let cachedProvider: AIProvider | null = null;

/**
 * Fábrica do provider de IA, no mesmo espírito de
 * `getBusinessDataProvider()` (Fase 3): a OpenAI já é o provedor
 * oficial decidido (docs/05-integrations.md), então diferente do caso
 * de dados empresariais (onde o provedor em si ainda era uma decisão
 * pendente), aqui o único "não configurado" possível é a ausência da
 * credencial neste ambiente — nunca simulamos uma resposta.
 */
export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  const env = getServerEnv();
  if (!isOpenAiConfigured(env)) {
    cachedProvider = new NotConfiguredAIProvider();
    return cachedProvider;
  }

  cachedProvider = new OpenAIProvider(env.OPENAI_API_KEY!, env.OPENAI_DEFAULT_MODEL ?? "gpt-4.1-mini");
  return cachedProvider;
}

export { AIProviderNotConfiguredError };
