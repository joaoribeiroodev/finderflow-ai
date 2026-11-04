import { z } from "zod";

/**
 * Validação de CPF/CNPJ para o cadastro de cliente no Asaas
 * (`POST /v3/customers` exige `cpfCnpj` — docs.asaas.com/reference/create-new-customer,
 * conferido durante a implementação da Fase 6). Implementa o algoritmo de
 * dígito verificador real (não apenas contagem de dígitos), para pegar
 * erros de digitação antes de gastar uma chamada à API do Asaas.
 */

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Rejeita sequências triviais (`00000000000`, `11111111111`, ...). */
function isTrivialSequence(digits: string): boolean {
  return /^(\d)\1*$/.test(digits);
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || isTrivialSequence(cpf)) return false;

  const digits = cpf.split("").map(Number);

  function checkDigit(length: number): number {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += digits[i] * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  }

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10];
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || isTrivialSequence(cnpj)) return false;

  const digits = cnpj.split("").map(Number);
  // Pesos padrão do algoritmo de CNPJ: o 2º dígito verificador soma 13
  // posições (inclui o 1º dígito verificador já calculado), por isso tem
  // sua própria lista de pesos — não é apenas um "deslocamento" da lista
  // de 12 pesos do 1º dígito.
  const firstDigitWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondDigitWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  function checkDigit(length: number, weights: number[]): number {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += digits[i] * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  }

  return (
    checkDigit(12, firstDigitWeights) === digits[12] &&
    checkDigit(13, secondDigitWeights) === digits[13]
  );
}

/** Aceita CPF (11 dígitos) ou CNPJ (14 dígitos) válidos, com ou sem máscara. */
export function isValidCpfOrCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

export const cpfCnpjSchema = z
  .string()
  .trim()
  .min(1, "Informe o CPF ou CNPJ.")
  .transform(onlyDigits)
  .refine((digits) => digits.length === 11 || digits.length === 14, {
    message: "CPF deve ter 11 dígitos ou CNPJ 14 dígitos.",
  })
  .refine((digits) => isValidCpfOrCnpj(digits), {
    message: "CPF ou CNPJ inválido (dígito verificador não confere).",
  });

export const billingProfileSchema = z.object({
  billingName: z
    .string()
    .trim()
    .min(2, "Informe a razão social ou nome completo.")
    .max(200, "Nome muito longo."),
  billingDocument: cpfCnpjSchema,
  billingEmail: z.string().trim().email("E-mail inválido."),
});

export type BillingProfileInput = z.infer<typeof billingProfileSchema>;
