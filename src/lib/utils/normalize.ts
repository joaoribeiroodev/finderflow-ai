/**
 * Normalização usada para deduplicação conservadora de empresas
 * (docs/03-database.md §3.4: "não assumir que nome seja identificador
 * único"; "não fundir empresas automaticamente apenas pelo nome").
 *
 * Estas funções só preparam os sinais de comparação — a decisão de
 * bloquear/avisar sobre duplicidade é de `companies.service.ts`.
 */

/** Minúsculas, sem acento, sem pontuação, espaços colapsados. Usado em `companies.normalized_name`. */
export function normalizeCompanyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mantém apenas dígitos (CNPJ). Retorna `null` se não restar nada. */
export function normalizeDocument(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/** Valida o dígito verificador de um CNPJ (14 dígitos). */
export function isValidCnpj(value: string | null | undefined): boolean {
  const digits = normalizeDocument(value);
  if (!digits || digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcCheckDigit = (base: string, weights: number[]): number => {
    const sum = base
      .split("")
      .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const digit1 = calcCheckDigit(digits.slice(0, 12), weights1);
  const digit2 = calcCheckDigit(digits.slice(0, 12) + digit1, weights2);

  return digits === digits.slice(0, 12) + String(digit1) + String(digit2);
}

/** Extrai o domínio (sem `www.`) de uma URL para comparação. `null` se inválida. */
export function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    const host = new URL(withProtocol).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/** Formata CNPJ (14 dígitos) como `00.000.000/0000-00` para exibição. */
export function formatCnpj(value: string | null | undefined): string | null {
  const digits = normalizeDocument(value);
  if (!digits || digits.length !== 14) return value ?? null;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
