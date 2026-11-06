"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

import type { CompaniesMapProps } from "./companies-map";

/**
 * `ssr: false` só é aceito dentro de um Client Component (Next.js 16 —
 * ver node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md) — daí
 * este wrapper separado em vez de usar `next/dynamic` direto na página
 * (que é um Server Component). O Leaflet acessa `window` ao ser
 * importado, então precisa mesmo ficar fora da renderização no servidor.
 */
const CompaniesMap = dynamic(() => import("./companies-map").then((mod) => mod.CompaniesMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] w-full items-center justify-center gap-2 rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] text-sm text-[var(--ff-text-muted)]">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando mapa...
    </div>
  ),
});

export function MapLoader(props: CompaniesMapProps) {
  return <CompaniesMap {...props} />;
}
