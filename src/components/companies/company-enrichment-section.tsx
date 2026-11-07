"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  enrichCompanyAction,
  reviewEnrichmentFieldAction,
  type EnrichmentActionResult,
} from "@/modules/companies/enrichment/enrichment.actions";
import type { EnrichmentFieldRow } from "@/modules/companies/enrichment/enrichment.service";

const initialState: EnrichmentActionResult = { success: false };

const FIELD_LABELS: Record<string, string> = {
  email: "E-mail",
  phone: "Telefone",
  website: "Site",
  social_instagram: "Instagram",
  social_facebook: "Facebook",
  social_linkedin: "LinkedIn",
  social_tiktok: "TikTok",
  social_youtube: "YouTube",
  social_twitter: "X / Twitter",
};

/**
 * Seção de "Enriquecimento" na página de detalhe da empresa (Módulo 1).
 * Mesmo princípio da `CompanyAnalysisSection` (IA): nunca grava nada
 * sozinha — cada campo encontrado aparece aqui como proposta até o
 * usuário aceitar ou rejeitar explicitamente.
 */
export function CompanyEnrichmentSection({
  companyId,
  initialFields,
}: {
  companyId: string;
  initialFields: EnrichmentFieldRow[];
}) {
  const [state, formAction, isPending] = useActionState(enrichCompanyAction, initialState);

  return (
    <Card>
      <CardHeader
        title="Enriquecimento"
        subtitle="Procura e-mail, telefone e redes sociais no site da empresa para você revisar."
        action={
          <form action={formAction}>
            <input type="hidden" name="companyId" value={companyId} />
            <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
              <Sparkles className="size-4" aria-hidden />
              {isPending ? "Analisando site..." : "Enriquecer"}
            </Button>
          </form>
        }
      />

      {state.message ? (
        <p
          role={state.success ? undefined : "alert"}
          className={`mb-3 text-sm ${state.success ? "text-[var(--ff-text-secondary)]" : "text-[var(--ff-danger)]"}`}
        >
          {state.message}
        </p>
      ) : null}

      {initialFields.length === 0 ? (
        !state.message ? (
          <p className="text-sm text-[var(--ff-text-secondary)]">
            Nenhum campo pendente de revisão. Clique em &quot;Enriquecer&quot; para procurar no site da empresa.
          </p>
        ) : null
      ) : (
        <ul className="flex flex-col gap-2">
          {initialFields.map((field) => (
            <li
              key={field.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] p-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                <span className="flex items-center gap-2 font-medium text-[var(--ff-text-primary)]">
                  {FIELD_LABELS[field.fieldKey] ?? field.fieldKey}
                  <Badge variant="outline">{Math.round(field.confidence * 100)}%</Badge>
                </span>
                <span className="break-all text-[var(--ff-text-secondary)]">{field.fieldValue}</span>
              </div>
              <div className="flex items-center gap-2">
                <form action={reviewEnrichmentFieldAction}>
                  <input type="hidden" name="fieldId" value={field.id} />
                  <input type="hidden" name="companyId" value={companyId} />
                  <input type="hidden" name="decision" value="accepted" />
                  <Button type="submit" size="sm" variant="secondary">
                    Aceitar
                  </Button>
                </form>
                <form action={reviewEnrichmentFieldAction}>
                  <input type="hidden" name="fieldId" value={field.id} />
                  <input type="hidden" name="companyId" value={companyId} />
                  <input type="hidden" name="decision" value="rejected" />
                  <Button type="submit" size="sm" variant="ghost">
                    Rejeitar
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
