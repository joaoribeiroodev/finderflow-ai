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
};

export default nextConfig;
