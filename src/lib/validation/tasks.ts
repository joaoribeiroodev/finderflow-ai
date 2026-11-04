import { z } from "zod";

export const TASK_STATUSES = ["pending", "in_progress", "completed", "canceled"] as const;
export const TASK_STATUS_LABELS: Record<(typeof TASK_STATUSES)[number], string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
  canceled: "Cancelada",
};

export const taskCreateSchema = z.object({
  leadId: z.string().uuid("Lead inválido."),
  title: z.string().trim().min(2, "Informe o título da tarefa.").max(160, "Título muito longo."),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  dueAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const taskStatusUpdateSchema = z.object({
  taskId: z.string().uuid("Tarefa inválida."),
  status: z.enum(TASK_STATUSES),
});
export type TaskStatusUpdateInput = z.infer<typeof taskStatusUpdateSchema>;
