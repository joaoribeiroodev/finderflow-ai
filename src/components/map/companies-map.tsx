"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Loader2 } from "lucide-react";

import { MAP_NEUTRAL_COLOR, type MapCompanyPoint, type StageLegendEntry } from "@/modules/map/map.types";

/** Centro aproximado do Brasil — usado quando ainda não há nenhuma empresa geocodificada. */
const BRAZIL_CENTER: [number, number] = [-14.235, -51.9253];
const BRAZIL_DEFAULT_ZOOM = 4;
const BATCH_POLL_DELAY_MS = 350;

export interface CompaniesMapProps {
  initialPoints: MapCompanyPoint[];
  stages: StageLegendEntry[];
  initialPendingCount: number;
}

interface GeocodeBatchResponse {
  geocoded: MapCompanyPoint[];
  failed: number;
  remaining: number;
}

/**
 * Mapa Leaflet + OpenStreetMap (gratuito, sem chave de API) da aba
 * "Mapa". Abre já populado com as empresas que tiverem lat/lng
 * (`initialPoints`, carregadas no servidor — ver `page.tsx`) e, em
 * paralelo, dispara o backfill incremental das que ainda não foram
 * geocodificadas: cada chamada a `/api/v1/map/geocode-batch` processa um
 * pequeno lote (respeitando 1 req/s do Nominatim do lado do servidor) e
 * devolve os novos pontos, que vão sendo adicionados ao mapa conforme
 * chegam — sem travar a abertura da aba nem recarregar a página.
 */
export function CompaniesMap({ initialPoints, stages, initialPendingCount }: CompaniesMapProps) {
  const [points, setPoints] = useState<MapCompanyPoint[]>(initialPoints);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [backfillError, setBackfillError] = useState(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    async function runBackfillLoop() {
      while (!stoppedRef.current) {
        let response: Response;
        try {
          response = await fetch("/api/v1/map/geocode-batch", { method: "POST" });
        } catch {
          setBackfillError(true);
          return;
        }

        if (!response.ok) {
          setBackfillError(true);
          return;
        }

        const batch = (await response.json()) as GeocodeBatchResponse;

        if (batch.geocoded.length > 0) {
          setPoints((current) => {
            const byId = new Map(current.map((point) => [point.id, point]));
            for (const point of batch.geocoded) byId.set(point.id, point);
            return Array.from(byId.values());
          });
        }

        setPendingCount(batch.remaining);

        const madeProgress = batch.geocoded.length > 0 || batch.failed > 0;
        if (batch.remaining <= 0 || !madeProgress) return;

        await new Promise((resolve) => setTimeout(resolve, BATCH_POLL_DELAY_MS));
      }
    }

    if (initialPendingCount > 0) {
      void runBackfillLoop();
    }

    return () => {
      stoppedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só dispara uma vez por montagem da aba
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return BRAZIL_CENTER;
    const sum = points.reduce(
      (acc, point) => ({ lat: acc.lat + point.latitude, lng: acc.lng + point.longitude }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / points.length, sum.lng / points.length];
  }, [points]);

  const zoom = points.length === 0 ? BRAZIL_DEFAULT_ZOOM : points.length === 1 ? 12 : 5;

  return (
    <div className="flex flex-col gap-3">
      {pendingCount > 0 && !backfillError ? (
        <p className="flex items-center gap-2 text-xs text-[var(--ff-text-muted)]">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Localizando {pendingCount} empresa{pendingCount === 1 ? "" : "s"} no mapa (geocodificação em
          segundo plano)...
        </p>
      ) : null}
      {backfillError ? (
        <p className="text-xs text-[var(--ff-text-muted)]">
          Não foi possível continuar localizando empresas agora. Recarregue a aba para tentar de novo.
        </p>
      ) : null}

      <div className="h-[560px] w-full overflow-hidden rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)]">
        {/* key no center/zoom inicial evita recriar o mapa a cada novo ponto chegando */}
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom
          className="h-full w-full"
          style={{ background: "var(--ff-bg-surface)" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((point) => (
            <CircleMarker
              key={point.id}
              center={[point.latitude, point.longitude]}
              radius={7}
              pathOptions={{
                color: point.stageColor,
                fillColor: point.stageColor,
                fillOpacity: 0.85,
                weight: 1.5,
              }}
            >
              <Popup>
                <div className="flex flex-col gap-1 text-sm">
                  <Link href={`/companies/${point.id}`} className="font-semibold text-violet-700 underline">
                    {point.name}
                  </Link>
                  {point.category ? <span className="text-xs text-gray-600">{point.category}</span> : null}
                  <span className="text-xs text-gray-600">
                    {[point.city, point.state].filter(Boolean).join(" - ") || "Localização aproximada"}
                  </span>
                  <span className="text-xs font-medium" style={{ color: point.stageColor }}>
                    {point.stageName ?? "Sem lead no pipeline"}
                  </span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ff-text-secondary)]">
        <span className="font-medium text-[var(--ff-text-muted)]">Etapas:</span>
        {stages.map((stage) => (
          <span key={stage.id} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: stage.color }}
              aria-hidden
            />
            {stage.name}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: MAP_NEUTRAL_COLOR }}
            aria-hidden
          />
          Sem lead
        </span>
      </div>
    </div>
  );
}
