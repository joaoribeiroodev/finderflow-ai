import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env/env.server";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Lê/escreve cookies de sessão httpOnly através do adaptador `cookies()` do Next.js.
 *
 * O `setAll` pode falhar quando chamado de um Server Component puro (sem
 * permissão de escrever cookies); isso é esperado e inofensivo porque o
 * `proxy.ts` já cuida de renovar a sessão a cada requisição.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getServerEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component — ignorado de propósito.
            // O proxy.ts renova a sessão antes da requisição chegar aqui.
          }
        },
      },
    },
  );
}
