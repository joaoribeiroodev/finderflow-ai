import { z } from "zod";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Informe o nome da organização.")
  .max(120, "Nome muito longo.");

export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "O identificador deve ter pelo menos 3 caracteres.")
  .max(48, "O identificador deve ter no máximo 48 caracteres.")
  .regex(SLUG_PATTERN, "Use apenas letras minúsculas, números e hífens (ex.: minha-agencia).");

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

/**
 * Papéis que um admin/owner pode atribuir a outro membro via convite ou
 * troca de papel. `owner` fica de fora — transferência de propriedade é
 * uma operação separada e mais sensível, não coberta pelo convite comum.
 */
export const ASSIGNABLE_ROLES = ["admin", "manager", "member", "viewer"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  role: z.enum(ASSIGNABLE_ROLES, { message: "Selecione um papel válido." }),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid("Membro inválido."),
  role: z.enum(ASSIGNABLE_ROLES, { message: "Selecione um papel válido." }),
});

/** Gera um slug sugerido a partir do nome, sem garantir unicidade. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
