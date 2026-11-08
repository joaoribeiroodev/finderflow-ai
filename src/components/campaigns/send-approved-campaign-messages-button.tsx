"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  enqueueApprovedCampaignMessagesAction,
  type CampaignMessageActionResult,
} from "@/modules/campaigns/campaign-messages.actions";

const initialState: CampaignMessageActionResult = { success: false };

/**
 * Enfileira (fila assíncrona — Fase 10) o envio de toda mensagem já
 * aprovada da campanha. Desabilitado quando não há nenhuma aprovada,
 * para não sugerir uma ação que não fará nada.
 */
export function SendApprovedCampaignMessagesButton({
  campaignId,
  approvedCount,
}: {
  campaignId: string;
  approvedCount: number;
}) {
  const [state, formAction, isPending] = useActionState(
    enqueueApprovedCampaignMessagesAction,
    initialState,
  );

  return (
    <div className="flex flex-col items-end gap-1.5">
      <form action={formAction}>
        <input type="hidden" name="campaignId" value={campaignId} />
        <Button type="submit" size="sm" disabled={isPending || approvedCount === 0} className="gap-1.5">
          <Send className="size-4" aria-hidden />
          {isPending ? "Enfileirando..." : `Enviar aprovadas (${approvedCount})`}
        </Button>
      </form>
      {state.message ? (
        <p role={state.success ? undefined : "alert"} className="text-xs text-[var(--ff-text-secondary)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
