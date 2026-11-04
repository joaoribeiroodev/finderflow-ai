import { z } from "zod";

/**
 * Validação de variáveis de ambiente server-side.
 * Nunca importar este módulo em código que roda no navegador:
 * ele lê segredos que não podem ser expostos via NEXT_PUBLIC_*.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_DEFAULT_MODEL: z.string().min(1).optional(),
  ASAAS_API_KEY: z.string().min(1).optional(),
  ASAAS_API_BASE_URL: z.string().url().optional(),
  ASAAS_WEBHOOK_TOKEN: z.string().min(1).optional(),
  ASAAS_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  BUSINESS_PROVIDER: z.string().min(1).optional(),
  BUSINESS_PROVIDER_API_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
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

/** Indica se um provedor de busca de empresas está configurado. */
export function isBusinessProviderConfigured(env: ServerEnv = getServerEnv()): boolean {
  return Boolean(env.BUSINESS_PROVIDER && env.BUSINESS_PROVIDER_API_KEY);
}
