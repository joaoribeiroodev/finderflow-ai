"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Download, Globe, GlobeLock, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/error-state";
import {
  checkWebPresenceAction,
  convertSearchResultToCompanyAction,
  searchCompaniesAction,
  type SearchActionResult,
  type SearchResultView,
} from "@/modules/prospecting/actions";

const initialState: SearchActionResult = { success: false };

type WebPresenceState =
  | { status: "unchecked" }
  | { status: "checking" }
  | { status: "has_website"; url?: string }
  | { status: "no_website" }
  | { status: "not_configured" }
  | { status: "error"; message: string };

function WebPresenceBadge({ state }: { state: WebPresenceState }) {
  if (state.status === "no_website") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ff-success)]">
        <GlobeLock className="size-3.5" aria-hidden /> Sem site identificado — oportunidade de contato
      </span>
    );
  }
  if (state.status === "has_website") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--ff-text-muted)]">
        <Globe className="size-3.5" aria-hidden />
        {state.url ? `Site encontrado: ${state.url}` : "Site encontrado"}
      </span>
    );
  }
  if (state.status === "error") {
    return (
      <span role="alert" className="text-xs text-[var(--ff-danger)]">
        {state.message}
      </span>
    );
  }
  if (state.status === "not_configured") {
    return (
      <span className="text-xs text-[var(--ff-text-muted)]">
        Verificação de site indisponível neste ambiente.
      </span>
    );
  }
  return null;
}

function initialPresenceState(result: SearchResultView): WebPresenceState {
  if (!result.cachedWebPresence) return { status: "unchecked" };
  return result.cachedWebPresence.hasWebsite
    ? { status: "has_website", url: result.cachedWebPresence.websiteUrl }
    : { status: "no_website" };
}

function ResultRow({ result }: { result: SearchResultView }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "converted" | "error">(
    result.alreadyConverted ? "converted" : "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const [isCheckingPresence, startPresenceTransition] = useTransition();
  const [presence, setPresence] = useState<WebPresenceState>(() => initialPresenceState(result));

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

  function handleCheckPresence() {
    startPresenceTransition(async () => {
      const outcome = await checkWebPresenceAction(result.searchResultId);
      if (outcome.checkerNotConfigured) {
        setPresence({ status: "not_configured" });
      } else if (!outcome.success) {
        setPresence({ status: "error", message: outcome.message ?? "Não foi possível verificar o site." });
      } else if (outcome.hasWebsite) {
        setPresence({ status: "has_website", url: outcome.websiteUrl });
      } else {
        setPresence({ status: "no_website" });
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
        <WebPresenceBadge state={presence} />
        {status === "error" && message ? (
          <p role="alert" className="text-xs text-[var(--ff-danger)]">
            {message}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {status === "converted" ? (
          <span className="inline-flex items-center gap-1 text-sm text-[var(--ff-success)]">
            <Check className="size-4" aria-hidden /> Cadastrada
          </span>
        ) : (
          <Button size="sm" variant="secondary" disabled={isPending} onClick={handleConvert}>
            {isPending ? "Cadastrando..." : "Adicionar como empresa"}
          </Button>
        )}
        {presence.status === "unchecked" || presence.status === "checking" ? (
          <Button size="sm" variant="ghost" disabled={isCheckingPresence} onClick={handleCheckPresence}>
            {isCheckingPresence ? "Verificando..." : "Verificar site"}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Lista de resultados reaproveitada pela busca em tempo real
 * (`ProspectingSearchForm`) e pelo histórico reaberto
 * (`SearchHistoryPanel`) — mesma renderização, mesmas ações (converter,
 * verificar site), e o mesmo link de exportação em XLSX quando há um
 * `searchId` (sempre há, tanto numa busca nova quanto numa reaberta).
 */
export function SearchResultsList({
  results,
  resolvedSegmentLabel,
  searchId,
}: {
  results: SearchResultView[];
  resolvedSegmentLabel?: string | null;
  searchId?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--ff-text-muted)]">
          {resolvedSegmentLabel ? `Segmento reconhecido: ${resolvedSegmentLabel}. ` : ""}
          {results.length} resultado{results.length === 1 ? "" : "s"} encontrado
          {results.length === 1 ? "" : "s"}.
        </p>
        {searchId && results.length > 0 ? (
          <a href={`/api/v1/search-results/${searchId}/export`} download>
            <Button size="sm" variant="secondary">
              <Download className="mr-2 size-4" aria-hidden /> Exportar XLSX
            </Button>
          </a>
        ) : null}
      </div>
      {results.length === 0 ? (
        <p className="text-sm text-[var(--ff-text-muted)]">
          Nenhuma empresa encontrada com esses filtros. Tente um segmento diferente ou só por UF.
        </p>
      ) : (
        <ul>
          {results.map((result) => (
            <ResultRow key={result.searchResultId} result={result} />
          ))}
        </ul>
      )}
    </div>
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
        <SearchResultsList
          results={state.results}
          resolvedSegmentLabel={state.resolvedSegmentLabel}
          searchId={state.searchId}
        />
      ) : state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
