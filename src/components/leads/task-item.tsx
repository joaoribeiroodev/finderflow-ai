import { CheckCircle2, Circle } from "lucide-react";

import { updateTaskStatusAction } from "@/modules/leads/crm-items.actions";
import { formatRelativeDateTime } from "@/lib/utils/format";
import type { TaskRow } from "@/modules/leads/leads.service";

export function TaskItem({ task, leadId }: { task: TaskRow; leadId: string }) {
  const isDone = task.status === "completed";
  const nextStatus = isDone ? "pending" : "completed";

  return (
    <li className="flex items-start gap-3 py-2.5">
      <form action={updateTaskStatusAction}>
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="status" value={nextStatus} />
        <button
          type="submit"
          aria-label={isDone ? "Marcar como pendente" : "Marcar como concluída"}
          className="mt-0.5 text-[var(--ff-text-muted)] hover:text-[var(--ff-violet-glow)]"
        >
          {isDone ? <CheckCircle2 className="size-5 text-[var(--ff-success)]" /> : <Circle className="size-5" />}
        </button>
      </form>
      <div className="flex-1">
        <p className={isDone ? "text-sm text-[var(--ff-text-muted)] line-through" : "text-sm text-[var(--ff-text-primary)]"}>
          {task.title}
        </p>
        {task.description ? (
          <p className="text-xs text-[var(--ff-text-muted)]">{task.description}</p>
        ) : null}
        {task.due_at ? (
          <p className="text-xs text-[var(--ff-text-muted)]">Prazo: {formatRelativeDateTime(task.due_at)}</p>
        ) : null}
      </div>
    </li>
  );
}
