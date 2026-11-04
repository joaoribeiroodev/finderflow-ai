import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env/env.server";
import type { Database } from "@/types/database";

const PUBLIC_PATH_PREFIXES = ["/login", "/register", "/recovery", "/auth"];

/**
 * Toda rota de API (`/api/**`) faz sua própria autenticação — sessão de
 * usuário quando aplicável (`createClient()` dentro do Route Handler), ou
 * um segredo próprio quando não há usuário (webhook do Asaas validado
 * pelo header `asaas-access-token`; job de reconciliação validado por
 * `CRON_SECRET` — Fase 6). Redirecionar uma chamada de API não
 * autenticada para `/login` (uma página HTML) nunca é correto: o Asaas
 * receberia um 307 para uma página de login em vez de qualquer resposta
 * JSON, e passaria a reentregar o evento indefinidamente sem jamais
 * alcançar o handler.
 *
 * **Achado durante a implementação da Fase 6** (nunca chegou a produção,
 * pego pelo QA real de build de produção): esta função já existia com um
 * prefixo público (`/api/billing/webhooks`) antecipado desde a Fase 0/1,
 * mas o caminho real implementado (`/api/v1/webhooks/asaas`,
 * `/api/v1/jobs/billing-sync`) não batia com ele — o webhook teria sido
 * silenciosamente redirecionado para `/login` em vez de processado. Em
 * vez de listar cada rota de API uma a uma (frágil a cada nova rota),
 * excluímos `/api/` inteiro do redirect — cada Route Handler já é
 * responsável pela própria autorização.
 */
function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return true;
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
