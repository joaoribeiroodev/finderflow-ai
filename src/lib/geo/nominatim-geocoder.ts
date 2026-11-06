import "server-only";

import { logger } from "@/lib/logger/logger";

/**
 * Geocodificação de endereços via Nominatim (nominatim.openstreetmap.org),
 * o serviço gratuito e open-source de geocodificação do próprio projeto
 * OpenStreetMap — escolhido para a aba "Mapa" junto com o Leaflet
 * (também OSM) por não exigir chave de API nem ter custo por uso.
 *
 * A política de uso do Nominatim (operations.osmfoundation.org/policies/nominatim)
 * exige:
 * - Máximo 1 requisição/segundo — `scheduleNominatimRequest()` abaixo serializa
 *   todas as chamadas do processo numa fila e garante esse intervalo mínimo.
 * - Um `User-Agent` que identifique a aplicação (nunca o default de HTTP
 *   client) — nunca o e-mail pessoal do usuário, só o nome do app.
 * - Resultados não devem ser cacheados "em massa" além do uso direto, mas
 *   guardar o par lat/lng já geocodificado de cada empresa no próprio
 *   registro dela (não um cache genérico de endereços) é exatamente o uso
 *   pretendido: evita bater de novo no serviço para o mesmo registro.
 */

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "FinderFlowAI/1.0 (CRM de prospecção B2B; uso interno, sem alto volume)";
const MIN_INTERVAL_MS = 1_100; // 1 req/s exigido pela política + margem de segurança
const REQUEST_TIMEOUT_MS = 10_000;

export interface GeocodableAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
}

/**
 * Fila serializada em memória do processo — garante o intervalo mínimo
 * entre requisições mesmo quando várias geocodificações são disparadas
 * "ao mesmo tempo" (ex.: backfill em lote). Reinicia a cada cold start da
 * função serverless, o que é aceitável: o objetivo é nunca disparar duas
 * requisições quase simultâneas a partir desta mesma instância, não
 * coordenar múltiplas instâncias (por isso o backfill também é feito em
 * lotes pequenos, nunca despejando todas as empresas pendentes de uma vez).
 */
let queueTail: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function scheduleNominatimRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return fn();
  });
  // Encadeia mesmo em caso de erro, para a fila nunca travar numa falha isolada.
  queueTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function buildQuery(address: GeocodableAddress): string | null {
  const parts = [address.street, address.city, address.state, "Brasil"].filter(
    (part): part is string => Boolean(part && part.trim().length > 0),
  );
  // Sem cidade/UF não há o que geocodificar com confiança (rua sozinha é
  // ambígua demais) — tratamos como endereço insuficiente, não como erro.
  if (!address.city && !address.state) return null;
  return parts.join(", ");
}

/**
 * Geocodifica um endereço, respeitando o limite de 1 req/s do Nominatim.
 * Retorna `null` quando o endereço é insuficiente para geocodificar ou
 * quando o Nominatim não encontrou nenhum resultado (não é um erro —
 * endereços de CNPJ às vezes são incompletos demais para o OSM localizar).
 * Lança apenas em falha de rede/timeout/5xx, para o chamador poder
 * distinguir "não encontrado" (não adianta tentar de novo) de "falhou,
 * tentar depois".
 */
export async function geocodeAddress(address: GeocodableAddress): Promise<GeocodeResult | null> {
  const query = buildQuery(address);
  if (!query) return null;

  return scheduleNominatimRequest(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        limit: "1",
        countrycodes: "br",
        q: query,
      });

      const response = await fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "user-agent": USER_AGENT,
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim respondeu ${response.status}.`);
      }

      const results = (await response.json()) as NominatimSearchResult[];
      if (!results || results.length === 0) return null;

      const [first] = results;
      const latitude = Number.parseFloat(first.lat);
      const longitude = Number.parseFloat(first.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

      return { latitude, longitude };
    } catch (error) {
      logger.error("Falha ao geocodificar endereço via Nominatim", {
        error: error instanceof Error ? error.message : "erro desconhecido",
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  });
}
