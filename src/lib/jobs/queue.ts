import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";
import type { Database, Json } from "@/types/database";

import { computeBackoffSeconds, shouldDeadLetter } from "./retry-policy";

/**
 * Fila assíncrona real sobre a tabela `jobs` (Fase 10 — fundações, ver
 * ETAPA-0-AUDITORIA.md seção 4: o schema existia desde o PRD original,
 * mas tinha zero usos — nenhum enqueue, nenhum worker, nenhum retry).
 *
 * Decisão registrada na auditoria (seção 6): em vez de contratar um
 * fornecedor de fila (Trigger.dev/Inngest/QStash — decisão de negócio
 * ainda pendente), esta primeira fase usa o que já existe: a própria
 * tabela `jobs` + um worker simples invocado por um cron HTTP (ver
 * src/app/api/v1/jobs/worker/route.ts + vercel.json). Se o volume exigir
 * um motor dedicado depois, a troca é só na implementação deste módulo
 * — o resto da aplicação (`enqueueJob`) não muda.
 */

export type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

export interface EnqueueJobInput {
  jobType: string;
  payload?: Json;
  organizationId?: string | null;
  /** Evita duplicar o mesmo trabalho se o chamador tentar de novo (ex.: clique duplo, retry de rede). */
  idempotencyKey?: string;
  /** Agenda para o futuro em vez de "o quanto antes" (ex.: cadência de follow-up). */
  runAfter?: Date;
  maxAttempts?: number;
}

/**
 * Enfileira um job. Idempotente quando `idempotencyKey` é informado: uma
 * segunda chamada com a mesma chave não cria um segundo job (conflito
 * tratado como sucesso silencioso — o job já está na fila).
 */
export async function enqueueJob(input: EnqueueJobInput): Promise<{ id: string } | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("jobs")
    .insert({
      job_type: input.jobType,
      payload: input.payload ?? {},
      organization_id: input.organizationId ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      run_after: (input.runAfter ?? new Date()).toISOString(),
      max_attempts: input.maxAttempts ?? 5,
    })
    .select("id")
    .single();

  if (error) {
    // Violação da unique constraint de idempotency_key não é uma falha
    // real — significa que o job já estava enfileirado.
    if (error.code === "23505") {
      logger.info("Job já enfileirado (idempotency_key duplicada)", {
        jobType: input.jobType,
        idempotencyKey: input.idempotencyKey,
      });
      return null;
    }
    logger.error("Falha ao enfileirar job", { error: error.message, jobType: input.jobType });
    throw new Error("Não foi possível enfileirar o job.");
  }

  return data;
}

/**
 * Reivindica atomicamente o próximo job elegível (`FOR UPDATE SKIP
 * LOCKED` dentro da função `claim_next_job` — ver migration
 * 20261107194500_fase10_foundations.sql; o supabase-js não expressa essa
 * sintaxe diretamente, por isso a função SQL). `null` quando não há
 * nenhum job pronto.
 */
export async function claimNextJob(
  jobTypes: string[] | null,
  workerId: string,
): Promise<JobRow | null> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("claim_next_job", {
    p_job_types: jobTypes ?? undefined,
    p_worker: workerId,
  });

  if (error) {
    logger.error("Falha ao reivindicar próximo job da fila", { error: error.message });
    throw new Error("Não foi possível reivindicar o próximo job.");
  }

  // A função retorna uma linha vazia (todos os campos null) quando não
  // há job elegível — não um erro, só "nada para fazer agora".
  if (!data || !(data as JobRow).id) return null;
  return data as JobRow;
}

export async function completeJob(jobId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({ status: "succeeded", completed_at: new Date().toISOString(), locked_at: null, locked_by: null })
    .eq("id", jobId);

  if (error) {
    logger.error("Falha ao marcar job como concluído", { error: error.message, jobId });
  }
}

/**
 * Registra uma falha. Se ainda houver tentativas disponíveis, reagenda
 * com backoff exponencial + jitter; caso contrário, promove a
 * `dead_letter` (ver docs/08-security-operations.md §8.6: "Dead-letter
 * queue para jobs esgotados").
 */
export async function failJob(job: JobRow, error: Error): Promise<void> {
  const admin = createAdminClient();
  const deadLetter = shouldDeadLetter(job.attempts, job.max_attempts);

  const update = deadLetter
    ? {
        status: "dead_letter",
        last_error: error.message,
        locked_at: null,
        locked_by: null,
        completed_at: new Date().toISOString(),
      }
    : {
        status: "queued",
        last_error: error.message,
        locked_at: null,
        locked_by: null,
        run_after: new Date(Date.now() + computeBackoffSeconds(job.attempts) * 1000).toISOString(),
      };

  const { error: updateError } = await admin.from("jobs").update(update).eq("id", job.id);

  if (updateError) {
    logger.error("Falha ao registrar falha de job", { error: updateError.message, jobId: job.id });
  }

  if (deadLetter) {
    logger.error("Job esgotou as tentativas e foi movido para dead_letter", {
      jobId: job.id,
      jobType: job.job_type,
      attempts: job.attempts,
      lastError: error.message,
    });
  }
}
