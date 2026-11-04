import { z } from "zod";

import { isValidCnpj } from "@/lib/utils/normalize";

const UF_PATTERN = /^[A-Z]{2}$/;

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const companyCnpjSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || isValidCnpj(v), "CNPJ inválido.");

export const companyManualSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa.").max(160, "Nome muito longo."),
  cnpj: companyCnpjSchema,
  category: optionalTrimmed(80),
  website: optionalTrimmed(200).refine(
    (v) => v === undefined || /^(https?:\/\/)?[^\s]+\.[^\s]+$/i.test(v),
    "Informe um site válido (ex.: empresa.com.br).",
  ),
  phone: optionalTrimmed(40),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || z.string().email().safeParse(v).success, "E-mail inválido."),
  street: optionalTrimmed(160),
  city: optionalTrimmed(80),
  state: optionalTrimmed(2).refine(
    (v) => v === undefined || UF_PATTERN.test(v.toUpperCase()),
    "UF deve ter 2 letras (ex.: BA).",
  ),
  zipCode: optionalTrimmed(12),
  // Quando o usuário já viu um aviso de possível duplicata e confirmou
  // que quer cadastrar mesmo assim (ver companies.service.ts).
  // `FormData.get()` devolve `null` (não `undefined`) quando o checkbox
  // não está presente no form — `.optional()` sozinho só aceita
  // `undefined` e rejeitaria toda submissão normal com erro "received
  // null" sem nenhum campo visível para mostrá-lo. `.nullish()` aceita
  // os dois.
  confirmDuplicate: z
    .string()
    .nullish()
    .transform((v) => v === "true"),
});
export type CompanyManualInput = z.infer<typeof companyManualSchema>;

/** Uma linha de CSV já mapeada para os campos de empresa (antes da validação por linha). */
export const companyCsvRowSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório (mín. 2 caracteres)."),
  cnpj: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || isValidCnpj(v), "CNPJ inválido."),
  category: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  website: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || z.string().email().safeParse(v).success, "E-mail inválido."),
  city: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  state: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type CompanyCsvRowInput = z.infer<typeof companyCsvRowSchema>;

/**
 * Campos de destino que podem receber uma coluna do CSV mapeada, na
 * ordem exibida no passo de mapeamento da UI de importação.
 */
export const CSV_TARGET_FIELDS = [
  { key: "name", label: "Nome", required: true },
  { key: "cnpj", label: "CNPJ", required: false },
  { key: "category", label: "Categoria/segmento", required: false },
  { key: "website", label: "Site", required: false },
  { key: "phone", label: "Telefone", required: false },
  { key: "email", label: "E-mail", required: false },
  { key: "city", label: "Cidade", required: false },
  { key: "state", label: "UF", required: false },
] as const;
export type CsvTargetFieldKey = (typeof CSV_TARGET_FIELDS)[number]["key"];
