import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const contactCreateSchema = z.object({
  companyId: z.string().uuid("Empresa inválida."),
  name: z.string().trim().min(2, "Informe o nome do contato.").max(160, "Nome muito longo."),
  position: optionalTrimmed(120),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || z.string().email().safeParse(v).success, "E-mail inválido."),
  phone: optionalTrimmed(40),
  preferredChannel: optionalTrimmed(40),
});
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
