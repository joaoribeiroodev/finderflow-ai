"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/error-state";
import {
  convertSearchResultToCompanyAction,
  searchCompaniesAction,
  type SearchActionResult,
  type SearchResultView,
} from "@/modules/prospecting/actions";

const initialState: SearchActionResult = { success: false };

function ResultRow({ result }: { result: SearchResultView }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "converted" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function handleConvert() {
    startTransition(async () => {
      const outcome = await convertSearchResultToCompanyAction(result.searchResultId);
      if (outcome.success) {
        setStatus("converted");
      } else {
        setStatus("error");
        setMessage(outcome.message ?? "Não foi possível cadastrar esta empresa.");
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 border-b border-[var(--ff-border-subtle)] py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <p className="font-medium text-[var(--ff-text-primary)]">{result.name}</p>
        {result.category ? <p className="text-sm text-[var(--ff-text-muted)]">{result.category}</p> : null}
        {result.address ? <p className="text-xs text-[var(--ff-text-muted)]">{result.address}</p> : null}
        {result.phone ? <p className="text-xs text-[var(--ff-text-muted)]">{result.phone}</p> : null}
        <p className="text-xs text-[var(--ff-text-muted)]">{result.attributionLabel}</p>
        {status === "error" && message ? (
          <p role="alert" className="text-xs text-[var(--ff-danger)]">
            {message}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">
        {status === "converted" ? (
          <span className="inline-flex items-center gap-1 text-sm text-[var(--ff-success)]">
            <Check className="size-4" aria-hidden /> Cadastrada
          </span>
        ) : (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={handleConvert}>
            {isPending ? "Cadastrando..." : "Adicionar como empresa"}
          </Button>
        )}
      </div>
    </li>
  );
}

export function ProspectingSearchForm() {
  const [state, formAction, isPending] = useActionState(searchCompaniesAction, initialState);

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="O que você procura" name="query" placeholder="Ex.: restaurantes, clínicas, academias" required />
          <Field label="Segmento (opcional)" name="segment" placeholder="Ex.: alimentação" />
          <Field label="Cidade (opcional)" name="city" />
          <Field label="UF (opcional)" name="state" maxLength={2} placeholder="BA" />
        </div>
        <div>
          <Button type="submit" disabled={isPending} size="sm">
            <Search className="mr-2 size-4" aria-hidden /> {isPending ? "Buscando..." : "Buscar empresas"}
          </Button>
        </div>
      </form>

      {state.providerNotConfigured ? (
        <ErrorState
          title="Busca automática ainda não está disponível"
          description="Nenhum provedor de dados de empresas foi integrado ainda — essa escolha depende de avaliar cobertura, custo e política de uso de cada opção (decisão registrada em docs/DECISIONS.md). Enquanto isso, cadastre manualmente ou importe uma planilha CSV."
          action={
            <Link href="/companies/import">
              <Button size="sm" variant="secondary">
                Importar CSV
              </Button>
            </Link>
          }
        />
      ) : state.success && state.results ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--ff-text-muted)]">
            {state.resolvedSegmentLabel ? `Segmento reconhecido: ${state.resolvedSegmentLabel}. ` : ""}
            {state.results.length} resultado{state.results.length === 1 ? "" : "s"} encontrado
            {state.results.length === 1 ? "" : "s"}.
          </p>
          {state.results.length === 0 ? (
            <p className="text-sm text-[var(--ff-text-muted)]">
              Nenhuma empresa encontrada com esses filtros. Tente um segmento diferente ou só por UF.
            </p>
          ) : (
            <ul>
              {state.results.map((result) => (
                <ResultRow key={result.searchResultId} result={result} />
              ))}
            </ul>
          )}
        </div>
      ) : state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
