import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/env/env.client";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para uso no navegador (Client Components).
 * Usa apenas a chave publicável — nunca a service role key.
 */
export function createClient() {
  const env = getClientEnv();

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
