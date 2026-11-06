"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Search, Target } from "lucide-react";

import { searchWorkspaceAction, type SearchResult } from "@/modules/search/actions";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function closeModal() {
    setOpen(false);
    setQuery("");
    setResults([]);
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
        setResults(data);
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const visibleResults = query.trim().length < 2 ? [] : results;

  function handleSelect(result: SearchResult) {
    closeModal();
    router.push(result.href);
  }

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
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar empresas ou leads..."
                className="w-full bg-transparent text-sm text-[var(--ff-text-primary)] outline-none placeholder:text-[var(--ff-text-muted)]"
              />
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              {query.trim().length < 2 ? (
                <p className="px-2 py-6 text-center text-sm text-[var(--ff-text-muted)]">
                  Digite pelo menos 2 caracteres.
                </p>
              ) : isPending ? (
                <p className="px-2 py-6 text-center text-sm text-[var(--ff-text-muted)]">Buscando...</p>
              ) : visibleResults.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-[var(--ff-text-muted)]">
                  Nenhum resultado para &quot;{query}&quot;.
                </p>
              ) : (
                visibleResults.map((r) => (
                  <button
                    key={`${r.kind}-${r.id}`}
                    type="button"
                    onClick={() => handleSelect(r)}
                    className="flex w-full items-center gap-3 rounded-[var(--ff-radius-sm)] px-2 py-2 text-left text-sm text-[var(--ff-text-secondary)] hover:bg-[#201832] hover:text-white"
                  >
                    {r.kind === "company" ? (
                      <Building2 className="size-4 shrink-0 text-[var(--ff-violet-glow)]" aria-hidden />
                    ) : (
                      <Target className="size-4 shrink-0 text-[var(--ff-violet-glow)]" aria-hidden />
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
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
