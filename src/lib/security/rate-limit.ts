/**
 * Rate limiting best-effort, em memória, por processo.
 *
 * LIMITAÇÃO CONHECIDA (documentada deliberadamente, não escondida — ver
 * docs/DECISIONS.md Fase 8): este contador vive na memória do processo
 * Node que está atendendo a requisição. Em um deploy serverless/edge com
 * múltiplas instâncias (ex.: Vercel com várias funções/regiões), cada
 * instância tem seu próprio contador — ou seja, o limite real efetivo é
 * "N por instância", não "N globalmente". Isso ainda bloqueia abuso simples
 * de uma única origem contra uma única instância, mas NÃO é uma defesa
 * confiável contra um ataque distribuído ou coordenado antes do beta
 * comercial. Para produção real, trocar por um contador compartilhado
 * (ex.: tabela no Postgres com `UPDATE ... RETURNING` atômico, ou um
 * provedor dedicado como Upstash Redis) — decisão de infraestrutura ainda
 * pendente, registrada aqui em vez de fingir que isto já resolve o
 * problema.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Evita crescimento ilimitado do Map em um processo de vida longa.
const MAX_TRACKED_KEYS = 50_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Janela fixa simples: `limit` requisições por `windowMs` para a mesma
 * `key`. Não é um sliding window nem um token bucket com burst — suficiente
 * para o objetivo de hardening desta fase (impedir abuso trivial), não
 * uma garantia de SLA de tráfego.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      buckets.clear();
    }
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/** IP do cliente a partir dos headers padrão de proxy/CDN. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
