import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";
import { enrichCompany } from "@/modules/companies/enrichment/enrichment.service";

import { enqueueJob, type JobRow } from "./queue";

/**
 * Registro de handlers por `job_type` (Fase 10 — fundações). Qualquer
 * módulo futuro (enriquecimento em lote, auditoria de site em lote,
 * disparo de cadência) registra seu próprio handler aqui em vez de criar
 * um segundo mecanismo de fila — ver ETAPA-0-AUDITORIA.md seção 9 item 1.
 */
export type JobHandler = (job: JobRow) => Promise<void>;

const STUCK_JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15min — maior que qualquer timeout de função esperado.
const RATE_LIMIT_COUNTER_RETENTION_MS = 24 * 60 * 60 * 1000;
const PERIODIC_INTERVAL_MS = 30 * 60 * 1000; // 30min

/** Agrupa um instante em "slots" de `intervalMs` — base da idempotência dos jobs periódicos abaixo. */
function slotFor(timestampMs: number, intervalMs: number): number {
  return Math.floor(timestampMs / intervalMs) * intervalMs;
}

/**
 * Jobs periódicos "se re-enfileiram": ao terminar com sucesso, agendam a
 * própria próxima execução. A `idempotencyKey` derivada do slot de
 * horário alvo garante que, mesmo se o worker rodar mais vezes que o
 * intervalo, não se acumulem execuções duplicadas na fila — a segunda
 * tentativa de enfileirar o mesmo slot só colide com a unique constraint
 * e é ignorada (ver enqueueJob).
 */
async function rescheduleSelf(jobType: string, intervalMs: number): Promise<void> {
  const nextSlot = slotFor(Date.now(), intervalMs) + intervalMs;
  await enqueueJob({
    jobType,
    runAfter: new Date(nextSlot),
    idempotencyKey: `${jobType}:${nextSlot}`,
  });
}

/** Enfileira a execução do slot atual (ou já vencido) — usado só para o bootstrap inicial da fila. */
async function enqueueCurrentSlot(jobType: string, intervalMs: number): Promise<void> {
  const currentSlot = slotFor(Date.now(), intervalMs);
  await enqueueJob({
    jobType,
    runAfter: new Date(currentSlot),
    idempotencyKey: `${jobType}:${currentSlot}`,
  });
}

/** Purga contadores de rate limit expirados há mais de 24h (ver migration fase10_foundations). */
async function cleanupRateLimitCounters(): Promise<void> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - RATE_LIMIT_COUNTER_RETENTION_MS).toISOString();
  const { error, count } = await admin
    .from("rate_limit_counters")
    .delete({ count: "exact" })
    .lt("reset_at", cutoff);

  if (error) throw new Error(error.message);
  logger.debug("Contadores de rate limit expirados purgados", { count: count ?? 0 });

  await rescheduleSelf("cleanup_rate_limit_counters", PERIODIC_INTERVAL_MS);
}

/**
 * Self-healing: um job travado em `processing` por mais que o timeout
 * esperado indica que o worker que o reivindicou morreu/timeout antes de
 * completar/falhar — devolve para `queued` para ser tentado de novo, em
 * vez de ficar perdido para sempre (ver docs/08 §8.6, "Dead-letter queue
 * para jobs esgotados" — aqui é o caso simétrico, "job preso" antes de
 * sequer esgotar tentativas).
 */
async function cleanupStuckJobs(): Promise<void> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STUCK_JOB_TIMEOUT_MS).toISOString();
  const { error, count } = await admin
    .from("jobs")
    .update({ status: "queued", locked_at: null, locked_by: null }, { count: "exact" })
    .eq("status", "processing")
    .lt("locked_at", cutoff);

  if (error) throw new Error(error.message);
  if (count) {
    logger.warn("Jobs travados em processing devolvidos à fila", { count });
  }

  await rescheduleSelf("cleanup_stuck_jobs", PERIODIC_INTERVAL_MS);
}

/**
 * Processa um job de enriquecimento (Módulo 1) — primeiro handler "de
 * negócio" da fila da Fase 10 (os outros dois são manutenção interna).
 * Usa o cliente admin porque o worker roda sem sessão de usuário
 * autenticado; a mesma função `enrichCompany` é usada pelo caminho
 * síncrono (botão "Enriquecer" na página da empresa, via cliente comum
 * sob RLS) e por aqui.
 */
async function handleEnrichCompany(job: JobRow): Promise<void> {
  const payload = job.payload as { companyId?: string } | null;
  const companyId = payload?.companyId;
  if (!job.organization_id || !companyId) {
    throw new Error("Job enrich_company sem organization_id/companyId.");
  }

  const admin = createAdminClient();
  const outcome = await enrichCompany(admin, job.organization_id, companyId);
  logger.info("Enriquecimento de empresa processado via fila", {
    companyId,
    organizationId: job.organization_id,
    status: outcome.status,
    proposedCount: outcome.proposedCount,
  });
}

const JOB_HANDLERS: Record<string, JobHandler> = {
  cleanup_rate_limit_counters: cleanupRateLimitCounters,
  cleanup_stuck_jobs: cleanupStuckJobs,
  enrich_company: handleEnrichCompany,
};

export function resolveJobHandler(jobType: string): JobHandler | null {
  return JOB_HANDLERS[jobType] ?? null;
}

/**
 * Garante que os jobs periódicos de manutenção existam na fila — chamado
 * pelo worker a cada invocação; é barato (um INSERT que normalmente
 * colide com a idempotency_key e não faz nada) e cobre tanto o primeiro
 * deploy (fila vazia) quanto uma lacuna depois de o worker ficar off por
 * um tempo.
 */
export async function ensurePeriodicJobsSeeded(): Promise<void> {
  await Promise.all([
    enqueueCurrentSlot("cleanup_rate_limit_counters", PERIODIC_INTERVAL_MS),
    enqueueCurrentSlot("cleanup_stuck_jobs", PERIODIC_INTERVAL_MS),
  ]);
}
