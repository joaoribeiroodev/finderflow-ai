import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

import type { ProviderCacheEntry, ProviderCacheStore } from "./cached-provider";

/**
 * Cache em `provider_response_cache` (migration
 * 20261109233000_evolucao_perf_security_hardening.sql). Usa o cliente
 * admin porque o cache é compartilhado entre organizações — é dado
 * público do provedor, não dado de tenant — e a tabela não tem política
 * de RLS para usuários. Erros são propagados; quem decide ignorá-los é o
 * `CachedBusinessDataProvider`.
 */
export class SupabaseProviderCacheStore implements ProviderCacheStore {
  async get(key: string): Promise<ProviderCacheEntry | null> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("provider_response_cache")
      .select("payload, fetched_at")
      .eq("cache_key", key)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    return { payload: data.payload, fetchedAt: data.fetched_at };
  }

  async set(key: string, entry: { provider: string; kind: "search" | "cnpj"; payload: unknown }): Promise<void> {
    const admin = createAdminClient();
    const { error } = await admin.from("provider_response_cache").upsert({
      cache_key: key,
      provider: entry.provider,
      kind: entry.kind,
      payload: entry.payload as Json,
      fetched_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
  }
}
