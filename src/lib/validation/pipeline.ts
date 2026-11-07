import { z } from "zod";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export const stageCreateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da etapa.").max(60, "Nome muito longo."),
  color: z
    .string()
    .trim()
    .regex(HEX_COLOR, "Cor inválida (use o seletor).")
    .default("#C68A3B"),
  // `null`/`undefined` = etapa aberta (não fecha o funil). Vêm de um
  // <select> sempre presente no DOM, então `.optional()` normal já cobre
  // o caso (ver companies.ts para o caso de campo ausente do DOM).
  resultType: z
    .enum(["", "won", "lost"])
    .optional()
    .transform((v) => (v === "won" || v === "lost" ? v : null)),
});
export type StageCreateInput = z.infer<typeof stageCreateSchema>;

export const stageUpdateSchema = stageCreateSchema.extend({
  stageId: z.string().uuid("Etapa inválida."),
});
export type StageUpdateInput = z.infer<typeof stageUpdateSchema>;

export const stageMoveDirectionSchema = z.object({
  stageId: z.string().uuid("Etapa inválida."),
  direction: z.enum(["up", "down"]),
});
