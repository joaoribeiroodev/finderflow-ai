import { z } from "zod";

export const DEAL_STATUSES = ["open", "won", "lost"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  open: "Em negociação",
  won: "Ganho",
  lost: "Perdido",
};

export const dealCloseSchema = z.object({
  status: z.enum(["won", "lost"], { message: "Informe se o negócio foi ganho ou perdido." }),
  lostReason: z
    .string()
    .trim()
    .max(400)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
}).refine((data) => data.status === "won" || data.lostReason !== undefined, {
  message: "Informe o motivo da perda.",
  path: ["lostReason"],
});
