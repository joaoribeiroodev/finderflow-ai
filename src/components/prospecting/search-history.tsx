"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  listSearchHistoryAction,
  reopenSearchAction,
  type SearchHistoryEntryView,
  type SearchResultView,
} from "@/modules/prospecting/actions";

import { SearchResultsList } from "./search-form";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function statusLabel(status: string): string {
  if (status === "completed") return "Concluída";
  if (status === "failed") return "Falhou";
  if (status === "queued") return "Em fila";
  return status;
}

function describeEntry(entry: SearchHistoryEntryView): string {
  const parts = [entry.segment, entry.city, entry.state].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Sem filtros adicionais";
}

/**
 * Histórico de buscas: lista as buscas já feitas e permite reabrir
 * qualquer uma delas sem gastar uma nova requisição ao provedor —
 * `reopenSearchAction` só lê o que já está salvo em `search_results`.
 */
export function SearchHistoryPanel() {
  const [entries, setEntries] = useState<SearchHistoryEntryView[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingList, startListTransition] = useTransition();

  const [openSearchId, setOpenSearchId] = useState<string | null>(null);
  const [openResults, setOpenResults] = useState<SearchResultView[] | null>(null);
  const [openSegmentLabel, setOpenSegmentLabel] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [isOpeningSearch, startOpenTransition] = useTransition();

  function loadPage(nextPage: number) {
    startListTransition(async () => {
      const outcome = await listSearchHistoryAction(nextPage);
      if (!outcome.success || !outcome.entries) {
        setLoadError(outcome.message ?? "Não foi possível carregar o histórico.");
        return;
      }
      setLoadError(null);
      setEntries(outcome.entries);
      setPage(outcome.page ?? nextPage);
      setTotal(outcome.total ?? 0);
      setPageSize(outcome.pageSize ?? 15);
    });
  }

  useEffect(() => {
    loadPage(1);
  }, []);

  function handleReopen(searchId: string) {
    setOpenError(null);
    startOpenTransition(async () => {
      const outcome = await reopenSearchAction(searchId);
      if (!outcome.success || !outcome.results) {
        setOpenError(outcome.message ?? "Não foi possível abrir esta busca.");
        setOpenSearchId(searchId);
        setOpenResults(null);
        return;
      }
      setOpenSearchId(searchId);
      setOpenResults(outcome.results);
      setOpenSegmentLabel(entries?.find((e) => e.searchId === searchId)?.segment ?? null);
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--ff-text-primary)]">
        <History className="size-4" aria-hidden /> Buscas anteriores
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {loadError}
        </p>
      ) : null}

      {isLoadingList && !entries ? (
        <p className="text-sm text-[var(--ff-text-muted)]">Carregando histórico...</p>
      ) : entries && entries.length === 0 ? (
        <p className="text-sm text-[var(--ff-text-muted)]">Nenhuma busca feita ainda.</p>
      ) : entries ? (
        <ul className="flex flex-col divide-y divide-[var(--ff-border-subtle)]">
          {entries.map((entry) => (
            <li key={entry.searchId} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <p className="font-medium text-[var(--ff-text-primary)]">&ldquo;{entry.query}&rdquo;</p>
                  <p className="text-xs text-[var(--ff-text-muted)]">{describeEntry(entry)}</p>
                  <p className="text-xs text-[var(--ff-text-muted)]">
                    {formatDate(entry.createdAt)} · {statusLabel(entry.status)} · {entry.totalResults} resultado
                    {entry.totalResults === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isOpeningSearch}
                  onClick={() => handleReopen(entry.searchId)}
                >
                  {isOpeningSearch && openSearchId === entry.searchId ? "Abrindo..." : "Ver resultados"}
                </Button>
              </div>

              {openSearchId === entry.searchId ? (
                openError ? (
                  <p role="alert" className="text-xs text-[var(--ff-danger)]">
                    {openError}
                  </p>
                ) : openResults ? (
                  <div className="rounded-md bg-[var(--ff-bg-elevated)] p-3">
                    <SearchResultsList
                      results={openResults}
                      resolvedSegmentLabel={openSegmentLabel}
                      searchId={entry.searchId}
                    />
                  </div>
                ) : null
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {entries && total > pageSize ? (
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" disabled={page <= 1 || isLoadingList} onClick={() => loadPage(page - 1)}>
            <ChevronLeft className="mr-1 size-4" aria-hidden /> Anterior
          </Button>
          <span className="text-xs text-[var(--ff-text-muted)]">
            Página {page} de {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page >= totalPages || isLoadingList}
            onClick={() => loadPage(page + 1)}
          >
            Próxima <ChevronRight className="ml-1 size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
