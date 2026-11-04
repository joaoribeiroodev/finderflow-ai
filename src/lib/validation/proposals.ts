import { z } from "zod";

export const PROPOSAL_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Rejeitada",
  expired: "Expirada",
};

/** Transições permitidas a partir de cada status (regra de negócio em memória — o banco também tem o CHECK dos valores válidos). */
export const PROPOSAL_ALLOWED_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: ["draft"],
  expired: ["draft"],
};

export function isAllowedProposalTransition(from: ProposalStatus, to: ProposalStatus): boolean {
  return PROPOSAL_ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Uma proposta "expirada" não é só um status persistido — também é
 * calculado em leitura a partir de `valid_until`, porque não há um job
 * dedicado rodando periodicamente só para isso (ver docs/DECISIONS.md).
 * Esta função é a definição única usada tanto na UI de detalhe quanto nos
 * relatórios, para a mesma proposta nunca aparecer como "enviada" num
 * lugar e "expirada" em outro.
 */
export function effectiveProposalStatus(
  status: ProposalStatus,
  validUntil: string | null,
  now: Date = new Date(),
): ProposalStatus {
  if (status === "sent" && validUntil && new Date(validUntil) < now) return "expired";
  return status;
}

export const proposalCreateSchema = z.object({
  leadId: z.string().uuid("Selecione um lead válido."),
  validUntil: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export const proposalItemSchema = z.object({
  serviceId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || z.string().uuid().safeParse(v).success, "Serviço inválido."),
  description: z.string().trim().min(2, "Descreva o item.").max(400, "Descrição muito longa."),
  quantity: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v > 0, "Quantidade deve ser maior que zero."),
  unitPrice: z
    .string()
    .trim()
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v >= 0, "Preço unitário inválido."),
});

export type ProposalItemInput = z.infer<typeof proposalItemSchema>;

export const proposalStatusChangeSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES),
});
