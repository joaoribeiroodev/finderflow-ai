import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env/env.server";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import type { Database } from "@/types/database";

const PUBLIC_PATH_PREFIXES = ["/login", "/register", "/recovery", "/auth"];

/**
 * Rate limiting (fase 8, hardening) — best-effort em memória, ver
 * src/lib/security/rate-limit.ts para a limitação conhecida em ambiente
 * multi-instância. Limites deliberadamente generosos para não travar uso
 * legítimo; o objetivo aqui é impedir abuso trivial de força bruta/flood,
 * não ser uma defesa de produção completa (WAF/rate limiting de borda).
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
  {
    // Webhook do Asaas: a entrega "at least once" pode reenviar o mesmo
    // evento várias vezes em pouco tempo — limite alto, só para conter um
    // flood anômalo, nunca para rejeitar retries legítimos.
    label: "asaas-webhook",
    test: (pathname, method) => method === "POST" && pathname === "/api/v1/webhooks/asaas",
    limit: 120,
    windowMs: 60_000,
  },
  {
    // Job de reconciliação: só deveria ser chamado por um scheduler
    // interno (protegido por CRON_SECRET) — nunca deveria passar de
    // poucas chamadas por minuto.
    label: "billing-sync-job",
    test: (pathname, method) => method === "POST" && pathname === "/api/v1/jobs/billing-sync",
    limit: 10,
    windowMs: 60_000,
  },
];

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
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  for (const rule of RATE_LIMITS) {
    if (!rule.test(pathname, method)) continue;
    const key = `${rule.label}:${clientIp(request)}`;
    const result = checkRateLimit(key, rule.limit, rule.windowMs);
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
