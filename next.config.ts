import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Cache Components ficou DESLIGADO (era `true` na Fase 0/1) — ver
  // docs/DECISIONS.md "Cache Components desativado (Fase 2)" para o motivo:
  // `export const instant = false` no layout raiz só suprime o aviso de
  // validação em dev, não evita um erro real em produção (`next start`)
  // quando o cliente Supabase SSR toca `Date.now()`/sessão fora do
  // contexto síncrono da renderização — isso derrubava /dashboard e
  // /settings (página em branco) descoberto via QA visual na Fase 2.
  // Como praticamente todo o app é autenticado/dinâmico por natureza,
  // o ganho de Cache Components aqui é mínimo frente ao risco.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Fase 8 (hardening): headers de segurança aplicados a toda resposta.
  // CSP é deliberadamente moderada (permite 'unsafe-inline' em estilo, que
  // o Next.js/Tailwind injeta em alguns casos) em vez de estrita com nonce
  // — algo a revisar com uma CSP baseada em nonce antes de produção real,
  // registrado em docs/DECISIONS.md em vez de afirmar proteção que não
  // existe ainda.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://api.openai.com https://*.asaas.com https://sandbox.asaas.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
