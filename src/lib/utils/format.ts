/**
 * Formatação de valores exibidos na UI (BRL, datas relativas em pt-BR).
 * Datas são armazenadas em UTC no banco (docs/DECISIONS.md); a formatação
 * aqui converte para o timezone do navegador/servidor de renderização —
 * timezone de organização configurável fica para uma fase posterior.
 */
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
