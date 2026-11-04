"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { Badge } from "@/components/ui/badge";
import {
  deleteStageAction,
  moveStageAction,
  updateStageAction,
  type StageActionResult,
} from "@/modules/pipeline/actions";
import type { PipelineStageRow } from "@/modules/pipeline/pipeline.service";

const initialState: StageActionResult = { success: false };

export function StageRow({
  stage,
  isFirst,
  isLast,
  leadCount,
}: {
  stage: PipelineStageRow;
  isFirst: boolean;
  isLast: boolean;
  leadCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateStageAction, initialState);

  // Sem auto-fechar o modo de edição ao salvar (evita o anti-padrão de
  // setState dentro de efeito/ref durante a renderização). O usuário
  // confirma visualmente pela mensagem "Salvo." e fecha com "Cancelar";
  // os dados da etapa já estão atualizados no banco imediatamente.
  if (editing) {
    return (
      <li className="flex flex-col gap-3 border-b border-[var(--ff-border-subtle)] p-3 last:border-b-0">
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="stageId" value={stage.id} />
          <div className="min-w-[180px] flex-1">
            <Field label="Nome" name="name" defaultValue={stage.name} errors={state.fieldErrors?.name} />
          </div>
          <input
            type="color"
            name="color"
            defaultValue={stage.color}
            className="h-11 w-14 rounded-xl border border-[var(--ff-border-subtle)] bg-transparent"
            aria-label="Cor da etapa"
          />
          <div className="min-w-[160px]">
            <SelectField label="Resultado" name="resultType" defaultValue={stage.result_type ?? ""}>
              <option value="">Aberta</option>
              <option value="won">Ganho</option>
              <option value="lost">Perdido</option>
            </SelectField>
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          {state.success ? <p className="w-full text-sm text-[var(--ff-success)]">Salvo.</p> : null}
          {state.message ? (
            <p role="alert" className="w-full text-sm text-[var(--ff-danger)]">
              {state.message}
            </p>
          ) : null}
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 border-b border-[var(--ff-border-subtle)] p-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="size-3 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden />
        <span className="font-medium text-[var(--ff-text-primary)]">{stage.name}</span>
        {stage.result_type ? (
          <Badge variant={stage.result_type === "won" ? "success" : "danger"}>
            {stage.result_type === "won" ? "Ganho" : "Perdido"}
          </Badge>
        ) : null}
        <span className="text-xs text-[var(--ff-text-muted)]">
          {leadCount} lead{leadCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <form action={moveStageAction}>
          <input type="hidden" name="stageId" value={stage.id} />
          <input type="hidden" name="direction" value="up" />
          <button
            type="submit"
            disabled={isFirst}
            aria-label={`Mover ${stage.name} para cima`}
            className="flex size-8 items-center justify-center rounded-lg text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)] disabled:opacity-30"
          >
            <ChevronUp className="size-4" />
          </button>
        </form>
        <form action={moveStageAction}>
          <input type="hidden" name="stageId" value={stage.id} />
          <input type="hidden" name="direction" value="down" />
          <button
            type="submit"
            disabled={isLast}
            aria-label={`Mover ${stage.name} para baixo`}
            className="flex size-8 items-center justify-center rounded-lg text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)] disabled:opacity-30"
          >
            <ChevronDown className="size-4" />
          </button>
        </form>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Editar ${stage.name}`}
          className="flex size-8 items-center justify-center rounded-lg text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]"
        >
          <Pencil className="size-4" />
        </button>
        <form action={deleteStageAction}>
          <input type="hidden" name="stageId" value={stage.id} />
          <button
            type="submit"
            disabled={leadCount > 0}
            aria-label={`Excluir ${stage.name}`}
            title={leadCount > 0 ? "Mova os leads desta etapa antes de excluir" : undefined}
            className="flex size-8 items-center justify-center rounded-lg text-[var(--ff-text-secondary)] hover:text-[var(--ff-danger)] disabled:opacity-30"
          >
            <Trash2 className="size-4" />
          </button>
        </form>
      </div>
    </li>
  );
}
