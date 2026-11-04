import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env/env.server";
import type { Database } from "@/types/database";

const PUBLIC_PATH_PREFIXES = ["/login", "/register", "/recovery", "/auth", "/api/billing/webhooks"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Renova a sessão Supabase em toda requisição e redireciona usuários não
 * autenticados para /login fora das rotas públicas.
 *
 * Importante: usamos `getClaims()` (valida o JWT) em vez de `getSession()`,
 * que apenas lê o cookie sem revalidar — isso evitaria detectar sessões
 * revogadas/expiradas.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const env = getServerEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims) && !error;

  const pathname = request.nextUrl.pathname;

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // IMPORTANTE: retornar sempre `supabaseResponse` (ou copiar seus cookies)
  // para que a sessão renovada chegue ao navegador.
  return supabaseResponse;
}
