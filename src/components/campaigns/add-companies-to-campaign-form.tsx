"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  addCompaniesToCampaignAction,
  type CampaignActionResult,
} from "@/modules/campaigns/campaigns.actions";

const initialState: CampaignActionResult = { success: false };

export function AddCompaniesToCampaignForm({
  campaignId,
  query,
  candidates,
}: {
  campaignId: string;
  query: string;
  candidates: { id: string; name: string; category: string | null }[];
}) {
  const [state, formAction, isPending] = useActionState(addCompaniesToCampaignAction, initialState);

  return (
    <div className="flex flex-col gap-4">
      <form action={`/campaigns/${campaignId}`} className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Buscar empresa por nome..."
          className="h-11 flex-1 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 text-sm text-[var(--ff-text-primary)] outline-none placeholder:text-[var(--ff-text-muted)] focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
        />
        <Button type="submit" variant="secondary" size="sm">
          Buscar
        </Button>
      </form>

      {query && candidates.length === 0 ? (
        <p className="text-sm text-[var(--ff-text-secondary)]">
          Nenhuma empresa encontrada para &quot;{query}&quot; (ou todas já estão nesta campanha).
        </p>
      ) : null}

      {candidates.length > 0 ? (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="campaignId" value={campaignId} />
          <ul className="flex flex-col gap-1.5">
            {candidates.map((company) => (
              <li key={company.id}>
                <label className="flex items-center gap-2 rounded-xl border border-[var(--ff-border-subtle)] px-3 py-2 text-sm text-[var(--ff-text-primary)]">
                  <input type="checkbox" name="companyId" value={company.id} />
                  {company.name}
                  {company.category ? (
                    <span className="text-xs text-[var(--ff-text-muted)]">— {company.category}</span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>

          {state.message ? (
            <p role={state.success ? undefined : "alert"} className="text-sm text-[var(--ff-text-secondary)]">
              {state.message}
            </p>
          ) : null}

          <div>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Adicionando..." : "Adicionar selecionadas"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
