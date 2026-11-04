import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganization } from "@/modules/organizations/active-organization";
import { Topbar } from "@/components/layout/topbar";

/**
 * Layout de todas as rotas autenticadas do workspace.
 * Resolve a organização ativa no servidor (nunca confia em valor do
 * browser) e redireciona para onboarding se o usuário não pertencer a
 * nenhuma organização ainda.
 *
 * Nota: a sidebar completa e o design system serão implementados na
 * Fase 2 (shell visual). Este layout fornece a topbar funcional mínima
 * necessária para a Fase 1 (seletor de organização, papel, logout).
 */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { activeOrganization, memberships } = await resolveActiveOrganization();

  if (!activeOrganization) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--ff-bg-canvas)]">
      <Topbar activeOrganization={activeOrganization} memberships={memberships} />
      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
