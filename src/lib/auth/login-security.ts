import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";

/**
 * Rate limit / lockout temporário de login (Fase 9, pedido explícito do
 * usuário: "tentativas de login sem sucesso bloqueio temporária").
 *
 * Usa `auth_login_attempts` (sem policies — só o cliente admin/service
 * role lê/escreve, mesmo padrão de `audit_logs`). Depende de
 * `SUPABASE_SERVICE_ROLE_KEY` estar configurada — se ainda não estiver
 * (`createAdminClient` lança), degrada para "nunca bloqueia" em vez de
 * quebrar o login: a chave pode ser adicionada depois, a qualquer
 * momento, sem mudança de código (ver docs/DECISIONS.md).
 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

export interface LoginLockoutStatus {
  locked: boolean;
  retryAfterMinutes?: number;
}

export async function checkLoginLockout(email: string): Promise<LoginLockoutStatus> {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { data, error } = await admin
      .from("auth_login_attempts")
      .select("succeeded, created_at")
      .eq("email", email.toLowerCase())
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_FAILED_ATTEMPTS);

    if (error) {
      logger.error("Falha ao verificar tentativas de login", { error: error.message });
      return { locked: false };
    }

    if (!data || data.length < MAX_FAILED_ATTEMPTS) return { locked: false };

    const allFailedInWindow = data.every((row) => !row.succeeded);
    if (!allFailedInWindow) return { locked: false };

    const oldestOfWindow = data[data.length - 1];
    const lockedUntilMs =
      new Date(oldestOfWindow.created_at).getTime() + LOCKOUT_WINDOW_MINUTES * 60 * 1000;
    const retryAfterMinutes = Math.max(1, Math.ceil((lockedUntilMs - Date.now()) / 60_000));

    return { locked: true, retryAfterMinutes };
  } catch (error) {
    // createAdminClient lança se SUPABASE_SERVICE_ROLE_KEY não estiver
    // configurada — não é um erro operacional, é um recurso ainda não
    // habilitado neste ambiente.
    logger.warn("Verificação de lockout de login indisponível (service role não configurada?)", {
      error: (error as Error).message,
    });
    return { locked: false };
  }
}

export async function recordLoginAttempt(email: string, succeeded: boolean): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("auth_login_attempts")
      .insert({ email: email.toLowerCase(), succeeded });
    if (error) {
      logger.error("Falha ao registrar tentativa de login", { error: error.message });
    }
  } catch (error) {
    logger.warn("Registro de tentativa de login indisponível (service role não configurada?)", {
      error: (error as Error).message,
    });
  }
}
