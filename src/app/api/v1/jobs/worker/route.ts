import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/env.server";
import { logger } from "@/lib/logger/logger";
import { claimNextJob, completeJob, failJob } from "@/lib/jobs/queue";
import { resolveJobHandler, ensurePeriodicJobsSeeded } from "@/lib/jobs/job-handlers";

/**
 * Worker da fila assíncrona (Fase 10 — fundações). Invocado pelo Vercel
 * Cron (ver `vercel.json`) a cada 5 minutos — a Vercel envia
 * automaticamente `Authorization: Bearer $CRON_SECRET` em chamadas de
 * Cron Job quando essa variável está configurada no projeto, então a
 * mesma verificação também cobre uma chamada manual de teste com o
 * header equivalente.
 *
 * `CRON_SECRET` já existia no schema de env (`src/lib/env/env.server.ts`)
 * desde a Fase 9, órfão do job de billing removido — esta rota é o que
 * volta a dar uso real a essa variável (ver ETAPA-0-AUDITORIA.md seção 5,
 * risco #8).
 *
 * Processa um lote limitado por tempo (não por contagem fixa) para nunca
 * passar perto do timeout de função da Vercel — cada job que sobrar
 * simplesmente espera a próxima invocação do cron.
 */
const MAX_BUDGET_MS = 50_000;
const WORKER_ID = "vercel-cron";

function isAuthorized(request: Request): boolean {
  const env = getServerEnv();
  if (!env.CRON_SECRET) {
    // Sem segredo configurado neste ambiente, a rota não pode ser
    // habilitada — nunca processar jobs sem autenticação nenhuma.
    return false;
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${env.CRON_SECRET}`;
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
  if (!isAuthorized(request)) {
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

// Vercel Cron só envia GET, mas aceitar POST com a mesma autenticação
// facilita um disparo manual (ex.: curl) sem depender do método exato.
export const POST = GET;
