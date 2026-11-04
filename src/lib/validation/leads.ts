import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const LEAD_PRIORITIES = ["low", "medium", "high"] as const;

export const leadDetailsUpdateSchema = z.object({
  priority: z.enum(LEAD_PRIORITIES),
  // Importante: nenhum `.catch()` aqui — um valor fora do intervalo (ex.:
  // probability > 100) precisa continuar sendo um erro de validação, não
  // ser silenciosamente descartado como `undefined`. `z.preprocess` roda
  // antes da validação de range, então o erro de range ainda aparece
  // normalmente em vez de ser engolido por uma conversão prévia.
  estimatedValue: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const trimmed = v.trim();
      return trimmed.length > 0 ? Number(trimmed.replace(",", ".")) : undefined;
    },
    z.number({ error: "Valor inválido." }).min(0).max(999_999_999).optional(),
  ),
  probability: z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const trimmed = v.trim();
      return trimmed.length > 0 ? Number(trimmed) : undefined;
    },
    z.number({ error: "Probabilidade inválida." }).min(0).max(100).optional(),
  ),
  serviceInterest: optionalTrimmed(160),
  // `datetime-local` manda "" quando vazio, mas o campo sempre existe no
  // DOM (não é condicional), então `.optional()` simples resolve.
  nextContactAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type LeadDetailsUpdateInput = z.infer<typeof leadDetailsUpdateSchema>;

/**
 * Mover um lead de etapa. `lossReason` só é renderizado na UI quando a
 * etapa de destino é de resultado "perdido" — pode, portanto, estar
 * estruturalmente ausente do FormData (`null`, não `""`), daí `.nullish()`
 * em vez de `.optional()` (mesma lição do checkbox `confirmDuplicate` na
 * Fase 3 — ver docs/DECISIONS.md).
 */
export const leadMoveStageSchema = z.object({
  stageId: z.string().uuid("Etapa inválida."),
  lossReason: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type LeadMoveStageInput = z.infer<typeof leadMoveStageSchema>;
