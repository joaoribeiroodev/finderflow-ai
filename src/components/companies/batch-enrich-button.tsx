"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { enqueueBatchEnrichmentAction } from "@/modules/companies/enrichment/enrichment.actions";

/**
 * Botão "Enriquecer empresas pendentes" na listagem de empresas (Módulo
 * 1). Só enfileira jobs `enrich_company` na fila da Fase 10 — o
 * processamento de fato acontece no worker, de forma assíncrona; por
 * isso o retorno é só uma confirmação de quantas empresas foram
 * enfileiradas, nunca um resultado do enriquecimento em si.
 */
export function BatchEnrichButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await enqueueBatchEnrichmentAction();
            setMessage(result.message ?? null);
          });
        }}
      >
        <Sparkles className="mr-2 size-4" aria-hidden />
        {isPending ? "Enfileirando..." : "Enriquecer empresas pendentes"}
      </Button>
      {message ? <p className="text-xs text-[var(--ff-text-secondary)]">{message}</p> : null}
    </div>
  );
}
