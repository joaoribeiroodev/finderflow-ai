import { z } from "zod";

/**
 * Validação de variáveis de ambiente server-side.
 * Nunca importar este módulo em código que roda no navegador:
 * ele lê segredos que não podem ser expostos via NEXT_PUBLIC_*.
 */

/**
 * String opcional que trata `""` (chave presente no `.env.local` mas vazia —
 * convenção comum em `KEY=` para "ainda não configurado") como ausente.
 * Sem isso, `.optional()` sozinho só cobre `undefined`, e um `.env.local`
 * real com placeholders vazios para integrações de fases futuras (OpenAI,
 * Asaas, provedor de empresas) quebra a validação à toa.
 */
function optionalString(shape: z.ZodString) {
  return z.preprocess((value) => (value === "" ? undefined : value), shape.optional());
}

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: optionalString(z.string().min(1)),
  OPENAI_API_KEY: optionalString(z.string().min(1)),
  OPENAI_DEFAULT_MODEL: optionalString(z.string().min(1)),
  ASAAS_API_KEY: optionalString(z.string().min(1)),
  ASAAS_API_BASE_URL: optionalString(z.string().url()),
  ASAAS_WEBHOOK_TOKEN: optionalString(z.string().min(1)),
  ASAAS_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  BUSINESS_PROVIDER: optionalString(z.string().min(1)),
  BUSINESS_PROVIDER_API_KEY: optionalString(z.string().min(1)),
  /** Só usado por `BUSINESS_PROVIDER=minha_receita`; permite apontar para uma instância auto-hospedada. */
  BUSINESS_PROVIDER_BASE_URL: optionalString(z.string().url()),
  /** Verificação de presença digital (site próprio) por busca — ver src/modules/companies/presence/. */
  BRAVE_SEARCH_API_KEY: optionalString(z.string().min(1)),
  CRON_SECRET: optionalString(z.string().min(1)),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

/**
 * Lê e valida `process.env` uma única vez. Lança erro descritivo
 * (sem revelar valores) quando algo obrigatório está ausente/malformado.
 */
export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Variáveis de ambiente inválidas ou ausentes:\n${issues}\n\nConsulte .env.example.`,
    );
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

/** Indica se o provedor de IA (OpenAI) está configurado neste ambiente. */
export function isOpenAiConfigured(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

/** Indica se o provedor Asaas está configurado neste ambiente. */
export function isAsaasConfigured(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(env.ASAAS_API_KEY && env.ASAAS_API_BASE_URL && env.ASAAS_WEBHOOK_TOKEN);
}

/**
 * Indica se um provedor de busca de empresas está configurado.
 * `minha_receita` é um caso especial: é gratuito e não exige chave de
 * API (ver docs/DECISIONS.md), então não depende de
 * `BUSINESS_PROVIDER_API_KEY`. Qualquer outro valor de `BUSINESS_PROVIDER`
 * (um provedor pago futuro) continua exigindo a chave.
 */
export function isBusinessProviderConfigured(env: ServerEnv = getServerEnv()): boolean {
  if (env.BUSINESS_PROVIDER === "minha_receita") return true;
  return Boolean(env.BUSINESS_PROVIDER && env.BUSINESS_PROVIDER_API_KEY);
}

/** Indica se a verificação de presença digital (site próprio) está configurada. */
export function isWebPresenceCheckerConfigured(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(env.BRAVE_SEARCH_API_KEY);
}
