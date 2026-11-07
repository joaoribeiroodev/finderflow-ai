import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";

import { checkRateLimit, type RateLimitResult } from "./rate-limit";

/**
 * Rate limiting distribuído via Postgres (Fase 10 — fundações, ver
 * ETAPA-0-AUDITORIA.md seção 5 risco #5 e a limitação documentada em
 * `rate-limit.ts`: o contador em memória é "N por instância", não "N
 * globalmente"). Usa `check_rate_limit()` (migration
 * 20261107194500_fase10_foundations.sql) em vez de contratar um
 * provedor dedicado (Redis/Upstash — decisão de negócio ainda pendente,
 * ver auditoria seção 6).
 *
 * Se o banco estiver indisponível ou a service role não configurada,
 * degrada para o contador em memória em vez de bloquear (ou liberar sem
 * limite algum) toda requisição — mesmo princípio de "nunca derrubar a
 * funcionalidade principal por causa de uma camada de hardening" usado
 * em login-security.ts.
 */
export async function checkDistributedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .rpc("check_rate_limit", {
        p_key: key,
        p_limit: limit,
        p_window_seconds: Math.ceil(windowMs / 1000),
      })
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "resposta vazia de check_rate_limit");
    }

    return {
      allowed: data.allowed,
      remaining: data.remaining,
      resetAt: new Date(data.reset_at).getTime(),
    };
  } catch (error) {
    logger.warn("Rate limit distribuído indisponível, usando contador em memória", {
      error: (error as Error).message,
      key,
    });
    return checkRateLimit(key, limit, windowMs);
  }
}
