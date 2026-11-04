import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { assertCanEditOrganization } from "@/lib/permissions/permissions";
import type { ConversationToolDefinition } from "@/lib/ai/provider";
import { createTask } from "@/modules/leads/crm-items.service";
import { getLeadDetail, listLeads, moveLeadStage, InvalidStageTransitionError } from "@/modules/leads/leads.service";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Allowlist de ferramentas do Copilot (Fase 5, item 6 do prompt mestre —
 * docs/05-integrations.md §5.1): o modelo NUNCA recebe SQL, credenciais
 * ou acesso livre ao banco — só pode chamar uma destas funções fixas,
 * cada uma validada e executada no servidor, usando o client Supabase
 * da PRÓPRIA sessão do usuário (nunca service role), já escopado por RLS
 * à organização ativa. `organizationId` nunca vem dos argumentos do
 * modelo — é sempre o valor resolvido no servidor (`requireActiveOrganization`),
 * exatamente como em toda Server Action do app.
 *
 * `mutating: true` marca ferramentas que alteram dados — essas exigem
 * confirmação explícita do usuário antes de executar (ver
 * `src/modules/ai/copilot.service.ts`), nunca rodam no mesmo turno em
 * que o modelo as propõe.
 *
 * `execute` recebe `args` como `unknown` e SEMPRE revalida com o próprio
 * `parameters.parse` antes de usá-lo — nunca confia no formato vindo do
 * modelo nem no que o chamador já validou. Isto também evita o problema
 * de variância de genéricos ao guardar ferramentas com schemas
 * diferentes numa mesma lista, e reforça defesa em profundidade.
 */
export interface CopilotToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType;
  mutating: boolean;
  /** Resumo em 1 frase da ação, usado no card de confirmação (só para ferramentas mutating). Recebe os args já validados. */
  describeForConfirmation?: (args: Record<string, unknown>) => string;
  execute: (
    supabase: Supabase,
    organizationId: string,
    userId: string,
    rawArgs: unknown,
  ) => Promise<unknown>;
}

const listLeadsArgs = z.object({
  search: z.string().trim().max(200).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  page: z.number().int().min(1).max(50).optional(),
});

const getLeadDetailsArgs = z.object({
  leadId: z.string().uuid(),
});

const getTasksDueArgs = z.object({
  withinDays: z.number().int().min(1).max(60).optional(),
});

const getPipelineMetricsArgs = z.object({});

const getSalesReportArgs = z.object({
  sinceDays: z.number().int().min(1).max(365).optional(),
});

const createTaskArgs = z.object({
  leadId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  dueAt: z.string().trim().optional(),
});

const updateLeadStageArgs = z.object({
  leadId: z.string().uuid(),
  stageId: z.string().uuid(),
  lossReason: z.string().trim().max(500).optional(),
});

export const COPILOT_TOOLS: CopilotToolDefinition[] = [
  {
    name: "list_leads",
    description:
      "Lista leads da organização ativa, com busca livre opcional por nome de empresa e filtro de prioridade.",
    parameters: listLeadsArgs,
    mutating: false,
    async execute(supabase, organizationId, _userId, rawArgs) {
      const args = listLeadsArgs.parse(rawArgs);
      const result = await listLeads(supabase, organizationId, {
        search: args.search,
        priority: args.priority,
        page: args.page,
      });
      return {
        total: result.total,
        page: result.page,
        leads: result.leads.map((lead) => ({
          id: lead.id,
          companyName: lead.company?.name ?? "desconhecida",
          stageName: lead.stage?.name ?? "desconhecida",
          priority: lead.priority,
          status: lead.status,
          score: lead.score,
          estimatedValue: lead.estimated_value,
        })),
      };
    },
  },
  {
    name: "get_lead_details",
    description: "Retorna detalhes completos de um lead específico pelo ID (empresa, contatos, interações, tarefas).",
    parameters: getLeadDetailsArgs,
    mutating: false,
    async execute(supabase, organizationId, _userId, rawArgs) {
      const args = getLeadDetailsArgs.parse(rawArgs);
      const lead = await getLeadDetail(supabase, organizationId, args.leadId);
      if (!lead) return { error: "Lead não encontrado." };
      return {
        id: lead.id,
        companyName: lead.company?.name ?? "desconhecida",
        stageName: lead.stage?.name ?? "desconhecida",
        priority: lead.priority,
        status: lead.status,
        score: lead.score,
        estimatedValue: lead.estimated_value,
        serviceInterest: lead.service_interest,
        contacts: lead.contacts.map((c) => ({ name: c.name, position: c.position })),
        openTasks: lead.tasks.filter((t) => t.status !== "completed" && t.status !== "canceled").length,
        lastInteraction: lead.interactions[0]?.content_summary ?? null,
      };
    },
  },
  {
    name: "get_tasks_due",
    description: "Lista tarefas pendentes/em andamento com vencimento nos próximos N dias (padrão 7).",
    parameters: getTasksDueArgs,
    mutating: false,
    async execute(supabase, organizationId, _userId, rawArgs) {
      const args = getTasksDueArgs.parse(rawArgs);
      const withinDays = args.withinDays ?? 7;
      const until = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_at, status, lead_id")
        .eq("organization_id", organizationId)
        .in("status", ["pending", "in_progress"])
        .lte("due_at", until)
        .order("due_at", { ascending: true })
        .limit(20);

      if (error) return { error: "Não foi possível buscar as tarefas." };
      return {
        tasks: (data ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          dueAt: t.due_at,
          status: t.status,
          leadId: t.lead_id,
        })),
      };
    },
  },
  {
    name: "get_pipeline_metrics",
    description: "Retorna a contagem de leads abertos por etapa do funil e o valor estimado total em aberto.",
    parameters: getPipelineMetricsArgs,
    mutating: false,
    async execute(supabase, organizationId, _userId, rawArgs) {
      getPipelineMetricsArgs.parse(rawArgs);
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("position", { ascending: true });

      const { data: leads } = await supabase
        .from("leads")
        .select("stage_id, estimated_value")
        .eq("organization_id", organizationId)
        .eq("status", "open")
        .is("archived_at", null);

      const byStage = new Map<string, { count: number; estimatedValue: number }>();
      for (const lead of leads ?? []) {
        const current = byStage.get(lead.stage_id) ?? { count: 0, estimatedValue: 0 };
        current.count += 1;
        current.estimatedValue += Number(lead.estimated_value ?? 0);
        byStage.set(lead.stage_id, current);
      }

      return {
        stages: (stages ?? []).map((s) => ({
          name: s.name,
          openLeads: byStage.get(s.id)?.count ?? 0,
          estimatedValue: byStage.get(s.id)?.estimatedValue ?? 0,
        })),
      };
    },
  },
  {
    name: "get_sales_report",
    description:
      "Retorna um resumo de leads ganhos/perdidos nos últimos N dias (padrão 30), com valor total ganho. Baseado na última atualização do lead, não em um registro histórico exato de data de fechamento.",
    parameters: getSalesReportArgs,
    mutating: false,
    async execute(supabase, organizationId, _userId, rawArgs) {
      const args = getSalesReportArgs.parse(rawArgs);
      const sinceDays = args.sinceDays ?? 30;
      const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from("leads")
        .select("status, estimated_value")
        .eq("organization_id", organizationId)
        .in("status", ["won", "lost"])
        .gte("updated_at", since);

      const won = (data ?? []).filter((l) => l.status === "won");
      const lost = (data ?? []).filter((l) => l.status === "lost");

      return {
        periodDays: sinceDays,
        wonCount: won.length,
        lostCount: lost.length,
        wonEstimatedValueTotal: won.reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0),
      };
    },
  },
  {
    name: "create_task",
    description: "Cria uma nova tarefa associada a um lead. Requer confirmação do usuário antes de executar.",
    parameters: createTaskArgs,
    mutating: true,
    describeForConfirmation: (args) => `Criar a tarefa "${args.title as string}" no lead ${args.leadId as string}.`,
    async execute(supabase, organizationId, _userId, rawArgs) {
      const args = createTaskArgs.parse(rawArgs);
      await assertCanEditOrganization(supabase, organizationId);
      await createTask(supabase, organizationId, {
        leadId: args.leadId,
        title: args.title,
        description: args.description,
        dueAt: args.dueAt,
      });
      return { success: true };
    },
  },
  {
    name: "update_lead_stage",
    description: "Move um lead para outra etapa do funil. Requer confirmação do usuário antes de executar.",
    parameters: updateLeadStageArgs,
    mutating: true,
    describeForConfirmation: (args) => `Mover o lead ${args.leadId as string} para a etapa ${args.stageId as string}.`,
    async execute(supabase, organizationId, _userId, rawArgs) {
      const args = updateLeadStageArgs.parse(rawArgs);
      await assertCanEditOrganization(supabase, organizationId);
      try {
        await moveLeadStage(supabase, args.leadId, args.stageId, args.lossReason);
        return { success: true };
      } catch (error) {
        if (error instanceof InvalidStageTransitionError) {
          return { success: false, error: error.message };
        }
        throw error;
      }
    },
  },
];

export function getCopilotTool(name: string): CopilotToolDefinition | undefined {
  return COPILOT_TOOLS.find((t) => t.name === name);
}

/** Converte a allowlist para o formato que o `AIProvider.respond()` espera. */
export function copilotToolsAsConversationTools(): ConversationToolDefinition[] {
  return COPILOT_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}
