import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const organizationProfileSchema = z.object({
  personType: z.enum(["company", "individual"]),
  legalName: optionalTrimmed(160),
  tradeName: optionalTrimmed(160),
  document: optionalTrimmed(32),
  senderName: optionalTrimmed(120),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || v.includes("@"), { error: "E-mail inválido." }),
  phone: optionalTrimmed(32),
  whatsappNumber: optionalTrimmed(32),
  website: optionalTrimmed(200),
  addressCity: optionalTrimmed(120),
  addressState: optionalTrimmed(2),
  pitch: optionalTrimmed(600),
  // Módulo 6 — Campanhas: texto de descadastro/oposição a contato.
  // Deliberadamente sem valor padrão da plataforma (ver migration
  // module6_campaigns) — cada organização escreve o seu; o backend exige
  // isso preenchido antes de permitir enviar qualquer mensagem de
  // campanha.
  unsubscribeText: optionalTrimmed(500),
});

export type OrganizationProfileFormInput = z.infer<typeof organizationProfileSchema>;
