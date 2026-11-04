"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { Field } from "@/components/ui/field";
import { moveLeadStageAction, type LeadActionResult } from "@/modules/leads/actions";

const initialState: LeadActionResult = { success: false };

export interface StageOption {
  id: string;
  name: string;
  isClosed: boolean;
  resultType: string | null;
}

export function MoveStageForm({
  leadId,
  currentStageId,
  stages,
}: {
  leadId: string;
  currentStageId: string;
  stages: StageOption[];
}) {
  const [state, formAction, isPending] = useActionState(moveLeadStageAction, initialState);
  const [selectedStageId, setSelectedStageId] = useState(currentStageId);
  const targetStage = stages.find((s) => s.id === selectedStageId);
  const needsLossReason = targetStage?.resultType === "lost";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <SelectField
        label="Etapa do funil"
        name="stageId"
        value={selectedStageId}
        onChange={(e) => setSelectedStageId(e.target.value)}
      >
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </SelectField>

      {needsLossReason ? (
        <Field label="Motivo da perda (opcional)" name="lossReason" placeholder="Ex.: Escolheu outro fornecedor" />
      ) : null}

      <Button type="submit" size="sm" disabled={isPending || selectedStageId === currentStageId}>
        {isPending ? "Movendo..." : "Mover lead"}
      </Button>

      {state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
