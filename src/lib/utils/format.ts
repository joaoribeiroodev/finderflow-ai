/**
 * Formatação de valores exibidos na UI (BRL, datas em pt-BR).
 * Datas são armazenadas em UTC no banco (docs/DECISIONS.md). `formatDate`
 * e `formatDateTime` fixam o timezone em `America/Sao_Paulo` explicitamente
 * — nunca o timezone do processo que renderiza. Isso importa porque toda
 * página de workspace é Server Component renderizada numa função serverless
 * da Vercel (região `iad1`, cujo relógio do processo é UTC, não horário de
 * Brasília); sem um `timeZone` explícito, `toLocaleDateString`/`toLocaleString`
 * usam o timezone do processo — e qualquer data/hora absoluta mostrada ficava
 * sistematicamente 3h adiantada (e podia até mostrar o dia errado perto da
 * meia-noite). Todo o sistema é de uso exclusivamente brasileiro (sem
 * timezone de organização configurável ainda), então fixar o Brasil é
 * correto aqui — diferente de `formatRelativeDateTime`, que é imune a esse
 * bug porque só calcula uma diferença de milissegundos, nunca uma hora de
 * parede. Ver docs/DECISIONS.md.
 */
const BR_TIMEZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: BR_TIMEZONE, dateStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BR_TIMEZONE,
  dateStyle: "short",
  timeStyle: "short",
});

/** Formata uma data ISO (UTC) como `dd/mm/aaaa`, sempre no horário de Brasília. */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** Formata uma data ISO (UTC) como `dd/mm/aaaa hh:mm`, sempre no horário de Brasília. */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/**
 * Formata uma data-calendário pura (coluna `date` do Postgres, ex.:
 * `valid_until`, `due_date` — sem hora, sem timezone, ex.: "2026-11-10")
 * como `dd/mm/aaaa`. Deliberadamente NÃO passa por `new Date(...)` nem por
 * nenhuma conversão de timezone: `new Date("2026-11-10")` é interpretado
 * como meia-noite UTC, e convertê-lo para o horário de Brasília (UTC-3)
 * sempre mostraria o dia anterior — um bug sutil e real que afetava
 * `valid_until` de propostas e `due_date` de cobranças antes desta correção.
 * Uma data-calendário nunca teve timezone; só rearranja os dígitos.
 */
export function formatCalendarDate(dateOnly: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOnly);
  if (!match) return dateOnly;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * Data-calendário de "hoje" no horário de Brasília, no formato `YYYY-MM-DD`
 * (mesmo formato de uma coluna `date` do Postgres) — para comparar com
 * segurança contra `valid_until`/`due_date` sem o bug de "um dia antes"
 * descrito em `formatCalendarDate`.
 */
const brTodayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: BR_TIMEZONE });

export function brazilTodayDateString(now: Date = new Date()): string {
  return brTodayFormatter.format(now);
}

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(value: number): string {
  return brlFormatter.format(value);
}

const relativeFormatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 1000 * 60 * 60 * 24 * 365 },
  { unit: "month", ms: 1000 * 60 * 60 * 24 * 30 },
  { unit: "day", ms: 1000 * 60 * 60 * 24 },
  { unit: "hour", ms: 1000 * 60 * 60 },
  { unit: "minute", ms: 1000 * 60 },
];

/** Formata uma data ISO como tempo relativo (ex.: "há 5 minutos", "em 2 dias"). */
export function formatRelativeDateTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();

  for (const { unit, ms } of UNITS) {
    if (Math.abs(diffMs) >= ms || unit === "minute") {
      return relativeFormatter.format(Math.round(diffMs / ms), unit);
    }
  }
  return relativeFormatter.format(0, "minute");
}
