import { z } from "zod";

export const INTERACTION_TYPES = ["call", "email", "whatsapp", "meeting", "note"] as const;
export const INTERACTION_TYPE_LABELS: Record<(typeof INTERACTION_TYPES)[number], string> = {
  call: "Ligação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  meeting: "Reunião",
  note: "Anotação",
};

export const interactionCreateSchema = z.object({
  leadId: z.string().uuid("Lead inválido."),
  type: z.enum(INTERACTION_TYPES, { message: "Selecione o tipo de interação." }),
  contentSummary: z
    .string()
    .trim()
    .min(2, "Descreva brevemente a interação.")
    .max(2000, "Resumo muito longo."),
  // BUG REAL encontrado via QA visual (ver docs/DECISIONS.md): o
  // formulário (InteractionForm) não renderiza um campo `occurredAt` —
  // a interação sempre usa "agora" por padrão. Isso significa que
  // `FormData.get("occurredAt")` retorna `null` (campo estruturalmente
  // ausente do DOM), não `undefined`/`""`. `.optional()` sozinho rejeita
  // `null` com "received null", e como nenhum `<Field>` exibe
  // `fieldErrors.occurredAt`, a submissão falhava silenciosamente sem
  // nenhuma mensagem visível — mesma classe de bug do `confirmDuplicate`
  // na Fase 3. `.nullish()` aceita `null` e `undefined`.
  occurredAt: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type InteractionCreateInput = z.infer<typeof interactionCreateSchema>;
