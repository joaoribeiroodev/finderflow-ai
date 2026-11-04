/**
 * Funções puras de agregação por mês (FF-082 "Tendência de leads e
 * receita"). Ficam isoladas de qualquer chamada ao Supabase para serem
 * testadas com dados sintéticos sem precisar de banco — a mesma função
 * que o dashboard usa é a que os testes unitários verificam, então não
 * existe uma segunda "definição" de métrica se divergindo em algum lugar
 * (regra do prompt mestre para esta fase: "métricas precisam de
 * definição única e testável").
 *
 * Os buckets são sempre meses civis em UTC (mesmo critério já documentado
 * em `src/lib/billing/entitlements.ts` para os períodos de cota) — nunca
 * no timezone do navegador, para o resultado não variar com quem está
 * olhando o dashboard.
 */

export interface MonthBucket {
  /** Ex.: "2026-11". */
  key: string;
  /** Ex.: "nov/26". */
  label: string;
  value: number;
}

const MONTH_LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return `${MONTH_LABELS[date.getUTCMonth()]}/${String(date.getUTCFullYear()).slice(2)}`;
}

/** Gera os `months` últimos buckets civis (mais antigo primeiro), terminando no mês de `now`. */
export function buildMonthBuckets(months: number, now: Date = new Date()): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
    buckets.push({ key: monthKey(d), label: monthLabel(d), value: 0 });
  }

  return buckets;
}

/**
 * Soma `valueOf(item)` dentro do bucket do mês de `dateOf(item)`. Itens
 * cujo mês não está entre os buckets gerados (fora da janela pedida) são
 * ignorados silenciosamente.
 */
export function aggregateByMonth<T>(
  items: T[],
  dateOf: (item: T) => string | null,
  valueOf: (item: T) => number,
  buckets: MonthBucket[],
): MonthBucket[] {
  const byKey = new Map(buckets.map((b) => [b.key, { ...b }]));

  for (const item of items) {
    const raw = dateOf(item);
    if (!raw) continue;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    const key = monthKey(date);
    const bucket = byKey.get(key);
    if (bucket) bucket.value += valueOf(item);
  }

  return buckets.map((b) => byKey.get(b.key) ?? b);
}
