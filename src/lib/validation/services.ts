import { z } from "zod";

export const PRICING_TYPES = ["fixed", "hourly", "custom", "recurring"] as const;
export type PricingType = (typeof PRICING_TYPES)[number];

export const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  fixed: "Preço fixo",
  hourly: "Por hora",
  custom: "Personalizado (definido na proposta)",
  recurring: "Recorrente",
};

/**
 * `base_price` é obrigatório para fixed/hourly/recurring (o catálogo
 * precisa de um preço de referência para a IA e para o construtor de
 * propostas sugerirem algo sensato) e opcional para `custom` (o valor só
 * existe por proposta, decidido caso a caso — nunca inventamos um preço
 * "padrão" para um serviço que o próprio catálogo declara como sob
 * negociação).
 */
export const serviceSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do serviço.").max(160, "Nome muito longo."),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    pricingType: z.enum(PRICING_TYPES, { message: "Tipo de precificação inválido." }),
    basePrice: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined))
      .transform((v) => (v ? Number(v.replace(",", ".")) : undefined))
      .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), "Preço inválido."),
    isActive: z.coerce.boolean().default(true),
  })
  .refine(
    (data) => data.pricingType === "custom" || data.basePrice !== undefined,
    { message: "Informe o preço base para este tipo de precificação.", path: ["basePrice"] },
  );

export type ServiceInput = z.infer<typeof serviceSchema>;
