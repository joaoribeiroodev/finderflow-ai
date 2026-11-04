"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/modules/ai/copilot-actions";

export function StartConversationButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      className="gap-1.5"
      disabled={isPending}
      onClick={() => startTransition(() => startConversationAction())}
    >
      <Plus className="size-4" aria-hidden />
      {isPending ? "Criando..." : "Nova conversa"}
    </Button>
  );
}
