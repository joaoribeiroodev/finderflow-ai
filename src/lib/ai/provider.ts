import "server-only";

import type { ZodType } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema interno, nunca exposto ao chamador externo
type AnyZodType = ZodType<any>;

/**
 * Contrato `AIProvider` (Fase 5, item 1 do prompt mestre — docs/05-integrations.md §5.1):
 * isola o SDK/endpoints da OpenAI do restante do domínio. Qualquer
 * módulo de negócio (Company Analyzer, Lead Scorer, Outreach Generator,
 * Copilot) depende só desta interface, nunca do SDK da OpenAI
 * diretamente — troca de provedor ou de versão de API fica contida em
 * `openai-provider.ts`.
 */

export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AIResultStatus = "completed" | "refused" | "incomplete" | "failed";

/**
 * Resultado de uma chamada estruturada. `data` é `null` quando `status`
 * não é `"completed"` — o chamador nunca deve supor que `data` existe
 * sem checar `status` primeiro.
 */
export interface AIResult<T> {
  data: T | null;
  model: string;
  responseId: string | null;
  usage: AIUsage;
  durationMs: number;
  status: AIResultStatus;
  promptKey: string;
  promptVersion: string;
  /** Fontes citadas pelo modelo (quando aplicável); vazio nesta fase (sem web search). */
  sources: string[];
  warnings: string[];
  /** Mensagem amigável quando `status !== "completed"`. */
  errorMessage?: string;
}

export interface StructuredAIInput<T> {
  /** Identificador estável da tarefa (ex.: "company_analyzer"), usado em prompts versionados e quotas. */
  promptKey: string;
  /** Versão do prompt em uso — nunca editar o texto de um prompt de produção sem bump de versão. */
  promptVersion: string;
  /** Modelo a usar; se omitido, o provider usa o padrão configurado por tarefa. */
  model?: string;
  /** Instruções de sistema — nunca incluir dado não confiável aqui (ver sanitize.ts). */
  instructions: string;
  /** Conteúdo do usuário/contexto de negócio, já sanitizado contra prompt injection. */
  input: string;
  /** Schema Zod usado para gerar o Structured Output E para revalidar a saída do modelo. */
  schema: ZodType<T>;
  /** Nome visível ao modelo para o JSON Schema gerado a partir do schema. */
  schemaName: string;
}

export interface ConversationMessageInput {
  role: "user" | "assistant" | "tool";
  content: string;
  /** Obrigatório quando `role === "tool"`: id da chamada de função que esta saída responde. */
  toolCallId?: string;
}

export interface ConversationToolDefinition {
  name: string;
  description: string;
  /**
   * Schema Zod dos parâmetros da ferramenta. O provider converte isto para
   * JSON Schema estrito internamente (via `zodResponsesFunction`); o chamador
   * nunca monta JSON Schema manualmente. Use `defineCopilotTool()`
   * (`src/lib/ai/copilot-tools.ts`, Fase 5 item 6) para criar estas definições.
   */
  parameters: AnyZodType;
}

export interface ConversationInput {
  promptKey: string;
  promptVersion: string;
  model?: string;
  instructions: string;
  messages: ConversationMessageInput[];
  tools?: ConversationToolDefinition[];
  /** Encadeia com uma resposta anterior da mesma conversa (Responses API `previous_response_id`). */
  previousResponseId?: string;
}

export interface ConversationToolCall {
  callId: string;
  name: string;
  /** Argumentos já desserializados do JSON retornado pelo modelo (não validados contra o schema aqui). */
  arguments: Record<string, unknown>;
}

export interface ConversationResult {
  /** Texto de resposta do modelo; vazio quando a resposta é só chamadas de ferramenta. */
  text: string;
  toolCalls: ConversationToolCall[];
  model: string;
  responseId: string | null;
  usage: AIUsage;
  durationMs: number;
  status: AIResultStatus;
  warnings: string[];
  errorMessage?: string;
}

export interface AIProvider {
  generateStructured<T>(input: StructuredAIInput<T>): Promise<AIResult<T>>;
  respond(input: ConversationInput): Promise<ConversationResult>;
}

export class AIProviderNotConfiguredError extends Error {
  constructor() {
    super(
      "A integração com IA (OpenAI) ainda não está configurada neste ambiente. Configure OPENAI_API_KEY para habilitar análise de empresas, qualificação de leads, geração de abordagens e o Copilot.",
    );
    this.name = "AIProviderNotConfiguredError";
  }
}

/** Usado quando `OPENAI_API_KEY` não está configurada — nunca finge uma resposta. */
export class NotConfiguredAIProvider implements AIProvider {
  async generateStructured<T>(): Promise<AIResult<T>> {
    throw new AIProviderNotConfiguredError();
  }
  async respond(): Promise<ConversationResult> {
    throw new AIProviderNotConfiguredError();
  }
}
