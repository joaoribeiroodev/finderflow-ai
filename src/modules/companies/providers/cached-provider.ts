import "server-only";

import { createHash } from "node:crypto";

import {
  BusinessSearchQueryTooBroadError,
  ProviderNotConfiguredError,
  type BusinessDataProvider,
  type BusinessSearchPage,
  type BusinessSearchQuery,
  type BusinessSearchResultItem,
} from "./business-data-provider";

/**
 * Decorador de cache para qualquer `BusinessDataProvider`.
 *
 * Motivo (docs/DECISIONS.md, "Evolução 2026-11-09"): o provedor gratuito
 * de CNPJ limita a taxa de buscas (429). Repetir a mesma consulta — o
 * mesmo usuário refazendo a busca, ou outra organização buscando o mesmo
 * segmento/UF — gastava esse limite à toa. O dado é público (cadastro da
 * Receita Federal, publicado em lotes), então reutilizar uma resposta
 * recente não muda o que o usuário vê.
 *
 * Duas regras:
 * - resposta "fresca" (dentro do TTL) é devolvida sem chamar o provedor;
 * - se o provedor falhar e existir uma resposta mais antiga (até
 *   `staleMaxAgeMs`), ela é devolvida marcada como `stale`, para a tela
 *   avisar que são dados de uma consulta anterior — melhor que um erro.
 *
 * `fetchedAt` de cada item nunca é reescrito: continua sendo o instante
 * em que o dado saiu do provedor de verdade.
 *
 * O cache é melhor esforço: qualquer falha ao ler/gravar (tabela ausente,
 * service role não configurada) vira uma chamada direta ao provedor.
 */

export interface ProviderCacheEntry {
  payload: unknown;
  fetchedAt: string;
}

export interface ProviderCacheStore {
  get(key: string): Promise<ProviderCacheEntry | null>;
  set(key: string, entry: { provider: string; kind: "search" | "cnpj"; payload: unknown }): Promise<void>;
}

export interface CachedProviderOptions {
  searchTtlMs?: number;
  cnpjTtlMs?: number;
  staleMaxAgeMs?: number;
  now?: () => number;
  /**
   * Quais campos da consulta de fato mudam a resposta do provedor. Por
   * padrão todos entram na chave; um provedor que ignora o texto livre
   * (como o Minha Receita, que só filtra por CNAE/UF) pode reduzir a
   * chave para aumentar a taxa de acerto.
   */
  searchKeyParts?: (query: BusinessSearchQuery) => unknown;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function normalizeText(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function defaultSearchKeyParts(query: BusinessSearchQuery): unknown {
  return {
    query: normalizeText(query.query),
    segment: normalizeText(query.segment),
    state: normalizeText(query.state),
    city: normalizeText(query.city),
    cnae: [...(query.cnaeCodes ?? [])].sort(),
    page: query.pageToken ?? null,
  };
}

/** Chave para provedores que só filtram por CNAE/UF/cidade (texto livre não altera a resposta). */
export function structuredSearchKeyParts(query: BusinessSearchQuery): unknown {
  return {
    state: normalizeText(query.state),
    city: normalizeText(query.city),
    cnae: [...(query.cnaeCodes ?? [])].sort(),
    page: query.pageToken ?? null,
  };
}

function hashKey(provider: string, kind: string, parts: unknown): string {
  return createHash("sha256").update(JSON.stringify([provider, kind, parts])).digest("hex");
}

function isPage(value: unknown): value is BusinessSearchPage {
  return typeof value === "object" && value !== null && Array.isArray((value as BusinessSearchPage).items);
}

function isItem(value: unknown): value is BusinessSearchResultItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as BusinessSearchResultItem).externalId === "string" &&
    typeof (value as BusinessSearchResultItem).name === "string"
  );
}

export class CachedBusinessDataProvider implements BusinessDataProvider {
  readonly name: string;
  readonly getByCnpj?: (cnpj: string) => Promise<BusinessSearchResultItem | null>;

  private readonly searchTtlMs: number;
  private readonly cnpjTtlMs: number;
  private readonly staleMaxAgeMs: number;
  private readonly now: () => number;
  private readonly searchKeyParts: (query: BusinessSearchQuery) => unknown;

  constructor(
    private readonly inner: BusinessDataProvider,
    private readonly store: ProviderCacheStore,
    options: CachedProviderOptions = {},
  ) {
    this.name = inner.name;
    this.searchTtlMs = options.searchTtlMs ?? DAY_MS;
    this.cnpjTtlMs = options.cnpjTtlMs ?? 7 * DAY_MS;
    this.staleMaxAgeMs = options.staleMaxAgeMs ?? 30 * DAY_MS;
    this.now = options.now ?? Date.now;
    this.searchKeyParts = options.searchKeyParts ?? defaultSearchKeyParts;

    if (inner.getByCnpj) {
      this.getByCnpj = (cnpj) => this.cachedGetByCnpj(cnpj);
    }
  }

  private async read(key: string): Promise<ProviderCacheEntry | null> {
    try {
      return await this.store.get(key);
    } catch {
      return null;
    }
  }

  private async write(key: string, kind: "search" | "cnpj", payload: unknown): Promise<void> {
    try {
      await this.store.set(key, { provider: this.name, kind, payload });
    } catch {
      // Cache é melhor esforço — a resposta do provedor já está em mãos.
    }
  }

  private ageMs(entry: ProviderCacheEntry): number {
    return this.now() - new Date(entry.fetchedAt).getTime();
  }

  async search(query: BusinessSearchQuery): Promise<BusinessSearchPage> {
    const key = hashKey(this.name, "search", this.searchKeyParts(query));
    const cached = await this.read(key);

    if (cached && isPage(cached.payload) && this.ageMs(cached) < this.searchTtlMs) {
      return { ...cached.payload, cache: { state: "fresh", fetchedAt: cached.fetchedAt } };
    }

    try {
      const page = await this.inner.search(query);
      // Página parcial (provedor caiu no meio) não é guardada: a próxima
      // tentativa deve buscar a lista completa.
      if (!page.partial) await this.write(key, "search", page);
      return page;
    } catch (error) {
      // Erros de entrada/configuração não têm relação com disponibilidade.
      if (error instanceof BusinessSearchQueryTooBroadError || error instanceof ProviderNotConfiguredError) {
        throw error;
      }
      if (cached && isPage(cached.payload) && this.ageMs(cached) < this.staleMaxAgeMs) {
        return { ...cached.payload, cache: { state: "stale", fetchedAt: cached.fetchedAt } };
      }
      throw error;
    }
  }

  private async cachedGetByCnpj(cnpj: string): Promise<BusinessSearchResultItem | null> {
    const digits = cnpj.replace(/\D/g, "");
    const key = hashKey(this.name, "cnpj", digits);
    const cached = await this.read(key);

    if (cached && isItem(cached.payload) && this.ageMs(cached) < this.cnpjTtlMs) {
      return cached.payload;
    }

    try {
      const item = await this.inner.getByCnpj!(digits);
      if (item) await this.write(key, "cnpj", item);
      return item;
    } catch (error) {
      if (cached && isItem(cached.payload) && this.ageMs(cached) < this.staleMaxAgeMs) {
        return cached.payload;
      }
      throw error;
    }
  }
}
