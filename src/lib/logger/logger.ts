/**
 * Logger estruturado mínimo, server-side.
 *
 * Fase 8 (hardening): além da convenção de nunca passar segredos no
 * contexto — que já era a regra desde a criação deste módulo —, o próprio
 * `emit()` agora varre o contexto e redige (`[REDACTED]`) qualquer campo
 * cujo nome combine com um padrão sensível (token, senha, segredo, cartão,
 * CPF/CNPJ, e-mail, telefone, authorization, etc.), recursivamente. Isso
 * transforma a regra de "nunca logar segredo" de uma disciplina de code
 * review para uma garantia estrutural: mesmo que um call site futuro passe
 * um objeto de erro inteiro ou um payload de terceiro sem higienizar antes,
 * o valor nunca chega ao sink de log sem passar por aqui.
 *
 * Em produção, trocar por um sink externo (ex.: provedor de
 * observabilidade) mantendo esta mesma interface — a redação continua
 * valendo porque acontece antes da serialização, não no sink.
 */
type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

const SENSITIVE_KEY_PATTERN =
  /token|senha|password|secret|segredo|api[-_]?key|authorization|auth[-_]?header|cookie|session|cartao|card[-_]?number|cvv|cvc|cpf|cnpj|email|e-?mail|phone|telefone|access[-_]?token|refresh[-_]?token|webhook[-_]?token/i;

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 4;

function redactValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = redactValue(val, depth + 1);
      }
    }
    return out;
  }

  return value;
}

function redactContext(context: LogContext | undefined): LogContext | undefined {
  if (!context) return context;
  return redactValue(context, 0) as LogContext;
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...redactContext(context),
  };

  const serialized = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(serialized);
      break;
    case "warn":
      console.warn(serialized);
      break;
    default:
      console.log(serialized);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};
