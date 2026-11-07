import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env/env.server";
import { clientIp } from "@/lib/security/rate-limit";
import { checkDistributedRateLimit } from "@/lib/security/distributed-rate-limit";
import type { Database } from "@/types/database";

const PUBLIC_PATH_PREFIXES = ["/login", "/register", "/recovery", "/auth"];

/**
 * Rate limiting (fase 8, hardening; distribuído desde a fase 10 — ver
 * ETAPA-0-AUDITORIA.md seção 5 risco #5). `checkDistributedRateLimit`
 * usa um contador real no Postgres (consistente entre instâncias/regiões
 * da Vercel) e só cai de volta no contador em memória de
 * src/lib/security/rate-limit.ts se o banco estiver inacessível —
 * nunca bloqueia login legítimo por causa disso. Limites deliberadamente
 * generosos para não travar uso legítimo; o objetivo aqui é impedir
 * abuso trivial de força bruta/flood, não ser uma defesa de produção
 * completa (WAF/rate limiting de borda).
 */
const RATE_LIMITS: Array<{ test: (pathname: string, method: string) => boolean; limit: number; windowMs: number; label: string }> = [
  {
    // Login/registro/recuperação: força bruta de credenciais.
    label: "auth",
    test: (pathname, method) =>
      method === "POST" && ["/login", "/register", "/recovery"].some((p) => pathname === p || pathname.startsWith(`${p}/`)),
    limit: 10,
    windowMs: 60_000,
  },
];

/**
 * Toda rota de API (`/api/**`) faz sua própria autenticação — sessão de
 * usuário quando aplicável (`createClient()` dentro do Route Handler), ou
 * um segredo próprio quando não há usuário (webhooks de integrações
 * externas, jobs agendados validados por `CRON_SECRET`).
 * Redirecionar uma chamada de API não autenticada para `/login` (uma
 * página HTML) nunca é correto: um webhook receberia um 307 para uma
 * página de login em vez de qualquer resposta JSON, e passaria a
 * reentregar o evento indefinidamente sem jamais alcançar o handler. Em
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
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  for (const rule of RATE_LIMITS) {
    if (!rule.test(pathname, method)) continue;
    const key = `${rule.label}:${clientIp(request)}`;
    const result = await checkDistributedRateLimit(key, rule.limit, rule.windowMs);
    if (!result.allowed) {
      return new NextResponse(JSON.stringify({ error: "too_many_requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        },
      });
    }
  }

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

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // IMPORTANTE: retornar sempre `supabaseResponse` (ou copiar seus cookies)
  // para que a sessão renovada chegue ao navegador.
  return supabaseResponse;
}
