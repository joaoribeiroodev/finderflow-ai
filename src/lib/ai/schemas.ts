import { z } from "zod";

/**
 * Schemas Zod das saídas estruturadas de IA (Fase 5, item 4 do prompt
 * mestre — docs/05-integrations.md §5.1, "Structured Outputs"). Usados
 * tanto para gerar o JSON Schema enviado à OpenAI (`zodTextFormat`)
 * quanto para revalidar a saída (`AIEngine.runStructuredAI`) antes de
 * persistir — nunca confiamos cegamente no `output_parsed` do SDK.
 *
 * Os nomes de campo em snake_case reproduzem literalmente o "Formato de
 * análise sugerido" do prompt mestre, em vez de traduzir para camelCase —
 * divergir do formato documentado sem necessidade seria uma divergência
 * não justificada (ver regra do prompt mestre sobre registrar divergências).
 */

const confidenceSchema = z.enum(["low", "medium", "high"]);
const prioritySchema = z.enum(["low", "medium", "high"]);

const observationSchema = z.object({
  claim: z.string().min(1),
  evidence: z.string().min(1),
  source: z.string().min(1),
  confidence: confidenceSchema,
  kind: z.enum(["fact", "inference"]),
});

const opportunitySchema = z.object({
  service_id: z.string().uuid().nullable(),
  service_name: z.string().min(1),
  reason: z.string().min(1),
  priority: prioritySchema,
});

const scoreBreakdownItemSchema = z.object({
  criterion: z.string().min(1),
  weight: z.number().min(0).max(100),
  score: z.number().min(0).max(100),
  rationale: z.string().min(1),
});

/** Análise estruturada de empresa (Company Analyzer). */
export const companyAnalysisSchema = z.object({
  summary: z.string().min(1),
  observations: z.array(observationSchema).max(20),
  opportunities: z.array(opportunitySchema).max(10),
  recommended_action: z.string().min(1),
  score: z.number().int().min(0).max(100),
  score_breakdown: z.array(scoreBreakdownItemSchema).max(10),
});
export type CompanyAnalysis = z.infer<typeof companyAnalysisSchema>;

/**
 * Qualificação de lead (Lead Scorer). Reusa o mesmo formato de
 * score_breakdown, mas os critérios e pesos são fixos pela regra de
 * negócio (docs/05-integrations.md "Lead scoring") — o modelo preenche
 * `score`/`rationale` por critério, nunca o `weight` (que é constante e
 * reafirmado na própria instrução enviada ao modelo).
 *
 * IMPORTANTE: `score` nunca deve ser chamado de "probabilidade de
 * compra" em nenhum texto exibido ao usuário (regra explícita do prompt
 * mestre) — é um placar de qualificação com peso ponderado, não uma
 * previsão estatística.
 */
export const LEAD_SCORE_CRITERIA = [
  { key: "service_fit", label: "Aderência ao serviço", weight: 25 },
  { key: "observable_need", label: "Necessidade observável", weight: 25 },
  { key: "data_quality", label: "Qualidade dos dados", weight: 15 },
  { key: "icp_fit", label: "Aderência ao perfil ideal (ICP)", weight: 15 },
  { key: "contact_ease", label: "Facilidade de contato", weight: 10 },
  { key: "interest_signals", label: "Sinais de interesse", weight: 10 },
] as const;

export const leadScoreSchema = z.object({
  summary: z.string().min(1),
  score_breakdown: z
    .array(
      z.object({
        criterion: z.enum(LEAD_SCORE_CRITERIA.map((c) => c.key) as [string, ...string[]]),
        score: z.number().min(0).max(100),
        rationale: z.string().min(1),
      }),
    )
    .length(LEAD_SCORE_CRITERIA.length),
  score: z.number().int().min(0).max(100),
  recommended_action: z.string().min(1),
});
export type LeadScoreResult = z.infer<typeof leadScoreSchema>;

/** Rascunho de abordagem/follow-up (Outreach Generator). */
export const outreachMessageSchema = z.object({
  channel: z.enum(["email", "whatsapp", "phone_script", "linkedin"]),
  subject: z.string().nullable(),
  message: z.string().min(1).max(4000),
  tone: z.enum(["formal", "casual", "consultivo"]),
  follow_up_suggestion: z.string().min(1),
});
export type OutreachMessage = z.infer<typeof outreachMessageSchema>;

/**
 * Insights de vendas (Sales Analyst, FF-085 "Insights IA com evidência e
 * período"). O modelo só INTERPRETA métricas já calculadas no servidor
 * (nunca recebe permissão para calcular ou inventar números) — por isso
 * cada insight exige `evidence` citando literalmente um valor que já
 * estava no input, e o período analisado é sempre ecoado de volta
 * (`period`) para a UI nunca mostrar uma interpretação sem deixar claro a
 * qual janela de tempo ela se refere.
 */
export const salesInsightSchema = z.object({
  claim: z.string().min(1),
  evidence: z.string().min(1),
  metric_key: z.string().min(1),
});

export const salesInsightsSchema = z.object({
  period_label: z.string().min(1),
  headline: z.string().min(1),
  insights: z.array(salesInsightSchema).min(1).max(8),
  risks: z.array(z.string().min(1)).max(5),
  recommended_actions: z.array(z.string().min(1)).min(1).max(5),
});
export type SalesInsights = z.infer<typeof salesInsightsSchema>;

/** Rascunho de proposta (Proposal Assistant). Nunca inserido direto no banco — o usuário revisa antes de salvar. */
export const proposalDraftItemSchema = z.object({
  service_id: z.string().uuid().nullable(),
  service_name: z.string().min(1),
  description: z.string().min(1),
  suggested_quantity: z.number().positive(),
  suggested_unit_price: z.number().min(0),
  rationale: z.string().min(1),
});

export const proposalDraftSchema = z.object({
  scope_summary: z.string().min(1),
  items: z.array(proposalDraftItemSchema).min(1).max(10),
  suggested_valid_days: z.number().int().min(1).max(90),
  notes: z.string().min(1),
});
export type ProposalDraft = z.infer<typeof proposalDraftSchema>;
