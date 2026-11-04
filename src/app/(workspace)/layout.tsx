import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganization } from "@/modules/organizations/active-organization";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

/**
 * Layout de todas as rotas autenticadas do workspace (Fase 2: shell visual
 * completo — sidebar, topbar, seletor de organização e navegação).
 * Resolve a organização ativa no servidor (nunca confia em valor do
 * browser) e redireciona para onboarding se o usuário não pertencer a
 * nenhuma organização ainda.
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
    <WorkspaceShell
      activeOrganization={activeOrganization}
      memberships={memberships}
      userEmail={user.email ?? null}
    >
      {children}
    </WorkspaceShell>
  );
}
