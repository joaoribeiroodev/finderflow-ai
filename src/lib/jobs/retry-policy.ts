/**
 * Política de retry/backoff da fila assíncrona (Fase 10 — fundações).
 * Extraída em funções puras (sem I/O) para ser testável sem banco —
 * `src/lib/jobs/queue.ts` só orquestra chamadas ao Supabase em torno
 * destas decisões.
 */

/** Backoff exponencial com jitter, limitado a 1h — mesma régua descrita em docs/08-security-operations.md §8.6. */
export function computeBackoffSeconds(attempts: number): number {
  const base = Math.min(2 ** attempts, 3600);
  const jitter = Math.random() * base * 0.2;
  return Math.round(base + jitter);
}

/** Depois de esgotar as tentativas, o job vai para `dead_letter` em vez de ser reagendado. */
export function shouldDeadLetter(attempts: number, maxAttempts: number): boolean {
  return attempts >= maxAttempts;
}
