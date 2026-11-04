import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Em Next.js 16 este arquivo substitui o antigo `middleware.ts`.
 * Roda em toda requisição (exceto assets estáticos) para renovar a sessão
 * Supabase e proteger rotas autenticadas.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
