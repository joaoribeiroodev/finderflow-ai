"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { updateCadenceStatusAction, type CadenceActionResult } from "@/modules/cadences/cadences.actions";
import type { CadenceStatus } from "@/modules/cadences/cadences.service";

const initialState: CadenceActionResult = { success: false };

export function CadenceStatusToggle({ cadenceId, status }: { cadenceId: string; status: CadenceStatus }) {
  const [, formAction, isPending] = useActionState(updateCadenceStatusAction, initialState);
  const nextStatus: CadenceStatus = status === "active" ? "archived" : "active";

  return (
    <form action={formAction}>
      <input type="hidden" name="cadenceId" value={cadenceId} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
        {isPending ? "Atualizando..." : status === "active" ? "Arquivar" : "Reativar"}
      </Button>
    </form>
  );
}
