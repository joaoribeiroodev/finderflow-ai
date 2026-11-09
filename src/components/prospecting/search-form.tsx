"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Download, Globe, GlobeLock, ScanSearch, Search, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/error-state";
import { PRESENCE_BATCH_MAX } from "@/modules/prospecting/constants";
import {
  checkWebPresenceAction,
  checkWebPresenceBatchAction,
  convertSearchResultToCompanyAction,
  convertSearchResultToLeadAction,
  type CheckWebPresenceActionState,
  searchByCnpjAction,
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
  if (state.status === "checking") {
    return <span className="text-xs text-[var(--ff-text-muted)]">Verificando site…</span>;
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

function presenceFromOutcome(outcome: CheckWebPresenceActionState): WebPresenceState {
  if (outcome.checkerNotConfigured) return { status: "not_configured" };
  if (!outcome.success) {
    return { status: "error", message: outcome.message ?? "Não foi possível verificar o site." };
  }
  return outcome.hasWebsite ? { status: "has_website", url: outcome.websiteUrl } : { status: "no_website" };
}

type ConversionState =
  | { status: "idle" }
  | { status: "company" }
  | { status: "lead"; leadId?: string }
  | { status: "error"; message: string };

function ResultRow({
  result,
  presence,
  onPresenceChange,
  bulkRunning,
}: {
  result: SearchResultView;
  presence: WebPresenceState;
  onPresenceChange: (state: WebPresenceState) => void;
  bulkRunning: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [conversion, setConversion] = useState<ConversionState>(
    result.alreadyConverted ? { status: "company" } : { status: "idle" },
  );
  const [isCheckingPresence, startPresenceTransition] = useTransition();

  function handleConvert() {
    startTransition(async () => {
      const outcome = await convertSearchResultToCompanyAction(result.searchResultId);
      setConversion(
        outcome.success
          ? { status: "company" }
          : { status: "error", message: outcome.message ?? "Não foi possível cadastrar esta empresa." },
      );
    });
  }

  function handleConvertToLead() {
    startTransition(async () => {
      const outcome = await convertSearchResultToLeadAction(result.searchResultId);
      if (outcome.success) {
        setConversion({ status: "lead", leadId: outcome.leadId });
      } else {
        setConversion({ status: "error", message: outcome.message ?? "Não foi possível criar o lead." });
      }
    });
  }

  function handleCheckPresence() {
    startPresenceTransition(async () => {
      onPresenceChange(presenceFromOutcome(await checkWebPresenceAction(result.searchResultId)));
    });
  }

  const canCheckPresence = presence.status === "unchecked" || presence.status === "error";

  return (
    <li className="flex flex-col gap-2 border-b border-[var(--ff-border-subtle)] py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <p className="font-medium text-[var(--ff-text-primary)]">{result.name}</p>
        {result.category ? <p className="text-sm text-[var(--ff-text-muted)]">{result.category}</p> : null}
        {result.address ? <p className="text-xs text-[var(--ff-text-muted)]">{result.address}</p> : null}
        {result.phone ? <p className="text-xs text-[var(--ff-text-muted)]">{result.phone}</p> : null}
        <p className="text-xs text-[var(--ff-text-muted)]">{result.attributionLabel}</p>
        <WebPresenceBadge state={presence} />
        {conversion.status === "error" ? (
          <p role="alert" className="text-xs text-[var(--ff-danger)]">
            {conversion.message}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {conversion.status === "lead" ? (
          <span className="inline-flex items-center gap-1 text-sm text-[var(--ff-success)]">
            <Check className="size-4" aria-hidden />
            {conversion.leadId ? (
              <Link href={`/leads/${conversion.leadId}`} className="hover:underline">
                Lead criado — abrir
              </Link>
            ) : (
              "Lead criado"
            )}
          </span>
        ) : (
          <>
            {conversion.status === "company" ? (
              <span className="inline-flex items-center gap-1 text-sm text-[var(--ff-success)]">
                <Check className="size-4" aria-hidden /> Cadastrada
              </span>
            ) : null}
            <Button size="sm" disabled={isPending} onClick={handleConvertToLead}>
              <UserPlus className="mr-2 size-4" aria-hidden />
              {isPending ? "Salvando..." : conversion.status === "company" ? "Criar lead" : "Adicionar como lead"}
            </Button>
            {conversion.status === "company" ? null : (
              <Button size="sm" variant="secondary" disabled={isPending} onClick={handleConvert}>
                Só cadastrar empresa
              </Button>
            )}
          </>
        )}
        {canCheckPresence ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={isCheckingPresence || bulkRunning}
            onClick={handleCheckPresence}
          >
            {isCheckingPresence ? "Verificando..." : "Verificar site"}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

type PresenceFilter = "all" | "no_website" | "has_website" | "unchecked";

const FILTER_LABELS: Record<PresenceFilter, string> = {
  all: "Todos",
  no_website: "Sem site",
  has_website: "Com site",
  unchecked: "Não verificados",
};

function matchesFilter(state: WebPresenceState, filter: PresenceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unchecked") return state.status !== "no_website" && state.status !== "has_website";
  return state.status === filter;
}

/**
 * Lista de resultados reaproveitada pela busca em tempo real
 * (`ProspectingSearchForm`) e pelo histórico reaberto
 * (`SearchHistoryPanel`) — mesma renderização, mesmas ações, e o mesmo
 * link de exportação em XLSX quando há um `searchId`.
 *
 * O estado de "tem site?" de cada linha mora aqui (não na linha) para
 * permitir a triagem: verificar todos de uma vez e filtrar por resultado.
 */
export function SearchResultsList({
  results,
  resolvedSegmentLabel,
  searchId,
  bulkPresenceCheck = false,
}: {
  results: SearchResultView[];
  resolvedSegmentLabel?: string | null;
  searchId?: string;
  /** Mostra "Verificar site de todos" — só quando o verificador não consome cota (ver `isBulkPresenceCheckAllowed`). */
  bulkPresenceCheck?: boolean;
}) {
  const [presenceById, setPresenceById] = useState<Record<string, WebPresenceState>>(() =>
    Object.fromEntries(results.map((result) => [result.searchResultId, initialPresenceState(result)])),
  );
  const [filter, setFilter] = useState<PresenceFilter>("all");
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const presenceOf = (id: string): WebPresenceState => presenceById[id] ?? { status: "unchecked" };

  const counts = useMemo(() => {
    const tally: Record<PresenceFilter, number> = { all: results.length, no_website: 0, has_website: 0, unchecked: 0 };
    for (const result of results) {
      const state = presenceById[result.searchResultId] ?? { status: "unchecked" };
      if (state.status === "no_website") tally.no_website += 1;
      else if (state.status === "has_website") tally.has_website += 1;
      else tally.unchecked += 1;
    }
    return tally;
  }, [results, presenceById]);

  const visible = results.filter((result) => matchesFilter(presenceOf(result.searchResultId), filter));

  async function handleCheckAll() {
    const pending = results
      .map((result) => result.searchResultId)
      .filter((id) => {
        const status = presenceOf(id).status;
        return status === "unchecked" || status === "error";
      });
    if (pending.length === 0) return;

    cancelRef.current = false;
    setBulkMessage(null);
    setBulk({ done: 0, total: pending.length });

    for (let index = 0; index < pending.length; index += PRESENCE_BATCH_MAX) {
      if (cancelRef.current) break;
      const chunk = pending.slice(index, index + PRESENCE_BATCH_MAX);

      setPresenceById((current) => ({
        ...current,
        ...Object.fromEntries(chunk.map((id) => [id, { status: "checking" } as WebPresenceState])),
      }));

      let outcome: Awaited<ReturnType<typeof checkWebPresenceBatchAction>>;
      try {
        outcome = await checkWebPresenceBatchAction(chunk);
      } catch {
        outcome = { success: false, message: "A verificação em lote foi interrompida. Tente de novo." };
      }

      if (!outcome.success || !outcome.outcomes) {
        setPresenceById((current) => ({
          ...current,
          ...Object.fromEntries(chunk.map((id) => [id, { status: "unchecked" } as WebPresenceState])),
        }));
        setBulkMessage(outcome.message ?? "Não foi possível verificar em lote agora.");
        break;
      }

      const updates = Object.fromEntries(
        outcome.outcomes.map((item) => [item.searchResultId, presenceFromOutcome(item)]),
      );
      setPresenceById((current) => ({ ...current, ...updates }));
      setBulk({ done: Math.min(index + chunk.length, pending.length), total: pending.length });
    }

    setBulk(null);
  }

  const bulkRunning = bulk !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--ff-text-muted)]">
          {resolvedSegmentLabel ? `Segmento reconhecido: ${resolvedSegmentLabel}. ` : ""}
          {results.length} resultado{results.length === 1 ? "" : "s"} encontrado
          {results.length === 1 ? "" : "s"}.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {bulkPresenceCheck && results.length > 1 ? (
            bulkRunning ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  cancelRef.current = true;
                }}
              >
                Verificando {bulk.done}/{bulk.total} — parar
              </Button>
            ) : counts.unchecked > 0 ? (
              <Button size="sm" variant="secondary" onClick={handleCheckAll}>
                <ScanSearch className="mr-2 size-4" aria-hidden /> Verificar site de todos ({counts.unchecked})
              </Button>
            ) : null
          ) : null}
          {searchId && results.length > 0 ? (
            <a href={`/api/v1/search-results/${searchId}/export`} download>
              <Button size="sm" variant="secondary">
                <Download className="mr-2 size-4" aria-hidden /> Exportar XLSX
              </Button>
            </a>
          ) : null}
        </div>
      </div>

      {bulkMessage ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {bulkMessage}
        </p>
      ) : null}

      {results.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar resultados por presença digital">
          {(Object.keys(FILTER_LABELS) as PresenceFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)] ${
                filter === key
                  ? "border-[var(--ff-purple-500)] bg-[var(--ff-bg-elevated)] text-[var(--ff-text-primary)]"
                  : "border-[var(--ff-border-subtle)] text-[var(--ff-text-muted)] hover:text-[var(--ff-text-primary)]"
              }`}
            >
              {FILTER_LABELS[key]} <span className="ff-tabular-nums">({counts[key]})</span>
            </button>
          ))}
        </div>
      ) : null}

      {results.length === 0 ? (
        <p className="text-sm text-[var(--ff-text-muted)]">
          Nenhuma empresa encontrada com esses filtros. Tente um segmento diferente ou só por UF.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-[var(--ff-text-muted)]">Nenhum resultado neste filtro.</p>
      ) : (
        <ul>
          {visible.map((result) => (
            <ResultRow
              key={result.searchResultId}
              result={result}
              presence={presenceOf(result.searchResultId)}
              onPresenceChange={(state) =>
                setPresenceById((current) => ({ ...current, [result.searchResultId]: state }))
              }
              bulkRunning={bulkRunning}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProspectingSearchForm({ bulkPresenceCheck = false }: { bulkPresenceCheck?: boolean }) {
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
        <>
          {state.notice ? (
            <p
              role="status"
              className="rounded-[var(--ff-radius-sm)] border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-elevated)] px-3 py-2 text-sm text-[var(--ff-text-secondary)]"
            >
              {state.notice}
            </p>
          ) : null}
          <SearchResultsList
            key={state.searchId}
            results={state.results}
            resolvedSegmentLabel={state.resolvedSegmentLabel}
            searchId={state.searchId}
            bulkPresenceCheck={bulkPresenceCheck}
          />
        </>
      ) : state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

const cnpjInitialState: SearchActionResult = { success: false };

/** Consulta direta por CNPJ — diferente da busca por segmento/UF, traz uma única empresa já identificada. */
export function CnpjSearchForm() {
  const [state, formAction, isPending] = useActionState(searchByCnpjAction, cnpjInitialState);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Buscar por CNPJ específico" name="cnpj" placeholder="00.000.000/0000-00" />
        </div>
        <Button type="submit" disabled={isPending} size="sm">
          <Search className="mr-2 size-4" aria-hidden /> {isPending ? "Buscando..." : "Buscar CNPJ"}
        </Button>
      </form>

      {state.success && state.results ? (
        state.results.length === 0 ? (
          <p className="text-sm text-[var(--ff-text-muted)]">CNPJ válido, mas não encontrado na base da Receita.</p>
        ) : (
          <SearchResultsList results={state.results} searchId={state.searchId} />
        )
      ) : state.message ? (
        <p role="alert" className="text-sm text-[var(--ff-danger)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
