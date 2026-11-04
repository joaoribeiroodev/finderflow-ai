import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env/env.server";
import type { Database } from "@/types/database";

/**
 * Cliente administrativo com Service Role Key.
 *
 * ⚠️ NUNCA importar este módulo em código que pode ser incluído no bundle
 * do navegador. Usar apenas em:
 * - Route Handlers de webhook (ex.: Asaas) que precisam gravar antes de
 *   qualquer verificação de sessão de usuário;
 * - Workers/jobs server-side que processam filas;
 * - Scripts administrativos/seed.
 *
 * Este cliente ignora RLS. Toda autorização deve ser reimplementada em
 * código ao usá-lo — nunca repasse resultados diretamente para o cliente
 * sem revalidar o escopo do tenant.
 */
export function createAdminClient() {
  const env = getServerEnv();

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada. O cliente admin não pode ser criado.",
    );
  }

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
