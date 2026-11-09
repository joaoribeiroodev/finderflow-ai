import { z } from "zod";

import { brazilTodayDateString } from "@/lib/utils/format";

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
 *
 * `valid_until` é uma data-calendário pura (coluna `date`, ex.:
 * "2026-11-10", sem hora/timezone). Comparar com `new Date(validUntil) <
 * now` (correção anterior) comparava contra meia-noite UTC daquele dia —
 * em horário de Brasília (UTC-3) isso expirava a proposta às 21h do dia
 * ANTERIOR ao que o usuário escolheu, quase um dia inteiro antes do
 * esperado. A comparação correta é por string "YYYY-MM-DD" contra o dia
 * de hoje em Brasília: a proposta continua válida durante todo o dia
 * `valid_until` (fuso de Brasília), expirando só a partir do dia seguinte.
 */
export function effectiveProposalStatus(
  status: ProposalStatus,
  validUntil: string | null,
  now: Date = new Date(),
): ProposalStatus {
  if (status === "sent" && validUntil && brazilTodayDateString(now) > validUntil) return "expired";
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
