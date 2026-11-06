"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, CornerDownLeft, FileText as PageIcon, Search, Target } from "lucide-react";

import { searchWorkspaceAction, type SearchResult } from "@/modules/search/actions";
import { ALL_NAV_ITEMS } from "@/config/navigation";

/** Remove acentos para comparação tolerante ("configuracoes" ~ "configurações"). */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Páginas do sistema como resultados de busca — instantâneo, sem round-trip. */
const PAGE_RESULTS: SearchResult[] = ALL_NAV_ITEMS.filter((item) => !item.comingInPhase).map((item) => ({
  id: item.href,
  kind: "page",
  title: item.label,
  subtitle: "Página",
  href: item.href,
}));

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function closeModal() {
    setOpen(false);
    setQuery("");
    setRemoteResults([]);
    setActiveIndex(0);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        closeModal();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const data = await searchWorkspaceAction(query);
        setRemoteResults(data);
        setActiveIndex(0);
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const pageMatches = useMemo(() => {
    const trimmed = normalize(query);
    if (trimmed.length < 1) return [];
    return PAGE_RESULTS.filter((p) => normalize(p.title).includes(trimmed));
  }, [query]);

  const visibleResults = useMemo(() => {
    if (query.trim().length < 1) return [];
    return [...pageMatches, ...remoteResults];
  }, [query, pageMatches, remoteResults]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  function handleSelect(result: SearchResult) {
    closeModal();
    router.push(result.href);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (visibleResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % visibleResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + visibleResults.length) % visibleResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = visibleResults[activeIndex];
      if (selected) handleSelect(selected);
    }
  }

  const showLoading = isPending && query.trim().length >= 2;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden min-w-0 flex-1 items-center gap-2 rounded-[var(--ff-radius-sm)] border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3 py-2 text-left text-sm text-[var(--ff-text-muted)] md:flex md:max-w-[320px]"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Buscar no sistema...</span>
        <span className="ml-auto text-xs text-[var(--ff-text-muted)]">⌘K</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-24">
          <div className="fixed inset-0" onClick={closeModal} aria-hidden />
          <div className="relative w-full max-w-[560px] rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] bg-[#150f23] shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-2 border-b border-[var(--ff-border-subtle)] px-4 py-3">
              <Search className="size-4 shrink-0 text-[var(--ff-text-muted)]" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Buscar páginas, empresas ou leads..."
                className="w-full bg-transparent text-sm text-[var(--ff-text-primary)] outline-none placeholder:text-[var(--ff-text-muted)]"
              />
              <span className="hidden shrink-0 items-center gap-1 text-xs text-[var(--ff-text-muted)] sm:flex">
                <CornerDownLeft className="size-3.5" aria-hidden /> selecionar
              </span>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              {query.trim().length < 1 ? (
                <p className="px-2 py-6 text-center text-sm text-[var(--ff-text-muted)]">
                  Digite para buscar páginas, empresas ou leads.
                </p>
              ) : visibleResults.length === 0 ? (
                showLoading ? (
                  <p className="px-2 py-6 text-center text-sm text-[var(--ff-text-muted)]">Buscando...</p>
                ) : (
                  <p className="px-2 py-6 text-center text-sm text-[var(--ff-text-muted)]">
                    Nenhum resultado para &quot;{query}&quot;.
                  </p>
                )
              ) : (
                <>
                  {visibleResults.map((r, index) => (
                    <button
                      key={`${r.kind}-${r.id}`}
                      type="button"
                      onClick={() => handleSelect(r)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex w-full items-center gap-3 rounded-[var(--ff-radius-sm)] px-2 py-2 text-left text-sm ${
                        index === activeIndex
                          ? "bg-[#201832] text-white"
                          : "text-[var(--ff-text-secondary)]"
                      }`}
                    >
                      {r.kind === "company" ? (
                        <Building2 className="size-4 shrink-0 text-[var(--ff-violet-glow)]" aria-hidden />
                      ) : r.kind === "lead" ? (
                        <Target className="size-4 shrink-0 text-[var(--ff-violet-glow)]" aria-hidden />
                      ) : (
                        <PageIcon className="size-4 shrink-0 text-[var(--ff-violet-glow)]" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{r.title}</span>
                        {r.subtitle ? (
                          <span className="block truncate text-xs text-[var(--ff-text-muted)]">
                            {r.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                  {showLoading ? (
                    <p className="px-2 py-2 text-center text-xs text-[var(--ff-text-muted)]">
                      Buscando empresas e leads...
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
