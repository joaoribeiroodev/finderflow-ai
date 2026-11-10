import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/env.server";
import { logger } from "@/lib/logger/logger";
import { claimNextJob, completeJob, failJob } from "@/lib/jobs/queue";
import { resolveJobHandler, ensurePeriodicJobsSeeded } from "@/lib/jobs/job-handlers";

/**
 * Worker da fila assíncrona (Fase 10 — fundações).
 *
 * Quem chama: o `pg_cron` do próprio Supabase, a cada 5 minutos (migration
 * 20261109233500_jobs_worker_pg_cron.sql). O plano Hobby da Vercel só
 * permite cron 1x/dia e só autentica a chamada se `CRON_SECRET` existir no
 * projeto, então o agendamento saiu do `vercel.json` e foi para o banco,
 * que já é gratuito e já faz parte da stack.
 *
 * Autenticação — duas formas aceitas, ambas `Authorization: Bearer ...`:
 * 1. o token que o banco gera e guarda no Vault, conferido de volta via
 *    `verify_jobs_worker_token` (nenhum segredo copiado para a Vercel);
 * 2. `CRON_SECRET`, se configurada — útil para disparo manual (curl) ou
 *    para voltar a usar um agendador HTTP externo.
 *
 * Processa um lote limitado por tempo (não por contagem fixa) para nunca
 * passar perto do timeout de função da Vercel — cada job que sobrar
 * simplesmente espera a próxima invocação.
 */
const MAX_BUDGET_MS = 50_000;
const WORKER_ID = "queue-worker";
const DB_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function isAuthorized(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);

  const env = getServerEnv();
  if (env.CRON_SECRET && safeEqual(token, env.CRON_SECRET)) return true;

  // Só consulta o banco para algo com o formato do token que ele gera —
  // uma chamada anônima qualquer não vira uma query.
  if (!DB_TOKEN_PATTERN.test(token)) return false;

  try {
    const { data, error } = await createAdminClient().rpc("verify_jobs_worker_token", { p_token: token });
    return !error && data === true;
  } catch {
    // Service role ausente ou função ainda não migrada: sem como validar.
    return false;
  }
}

async function runWorkerBatch(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const startedAt = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  await ensurePeriodicJobsSeeded();

  while (Date.now() - startedAt < MAX_BUDGET_MS) {
    const job = await claimNextJob(null, WORKER_ID);
    if (!job) break;

    processed += 1;
    const handler = resolveJobHandler(job.job_type);

    if (!handler) {
      // Tipo de job desconhecido nunca vai ter sucesso em uma próxima
      // tentativa — dead-letter imediato em vez de gastar retries nele.
      await failJob({ ...job, attempts: job.max_attempts }, new Error(`job_type desconhecido: ${job.job_type}`));
      failed += 1;
      continue;
    }

    try {
      await handler(job);
      await completeJob(job.id);
      succeeded += 1;
    } catch (error) {
      await failJob(job, error as Error);
      failed += 1;
    }
  }

  return { processed, succeeded, failed };
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await runWorkerBatch();
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Falha na execução do worker da fila", { error: (error as Error).message });
    return NextResponse.json({ error: "Falha ao processar a fila." }, { status: 500 });
  }
}

// O pg_cron chama com GET, mas aceitar POST com a mesma autenticação
// facilita um disparo manual (ex.: curl) sem depender do método exato.
export const POST = GET;
