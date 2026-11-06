import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganization } from "@/modules/organizations/active-organization";
import { isCurrentUserSuperAdmin } from "@/modules/organizations/organizations.service";
import { listNotifications } from "@/modules/notifications/notifications.service";
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

  const isSuperAdmin = await isCurrentUserSuperAdmin(supabase);

  // Fase 9: aprovação manual substitui a confirmação de e-mail como
  // controle de acesso. Super admin da plataforma nunca é bloqueado,
  // mesmo que a própria organização esteja pendente.
  if (!isSuperAdmin && activeOrganization.approvalStatus !== "approved") {
    redirect("/pending-approval");
  }

  const notifications = await listNotifications(supabase, activeOrganization.organizationId, user.id);

  return (
    <WorkspaceShell
      activeOrganization={activeOrganization}
      memberships={memberships}
      userEmail={user.email ?? null}
      isSuperAdmin={isSuperAdmin}
      notifications={notifications}
    >
      {children}
    </WorkspaceShell>
  );
}
