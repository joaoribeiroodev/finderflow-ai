"use client";

import { useState, type ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { MembershipSummary } from "@/modules/organizations/organizations.service";

/**
 * Casca do workspace: sidebar fixa (drawer em mobile) + topbar + conteúdo.
 * Único estado de UI real nesta fase é a visibilidade do drawer mobile —
 * mantido aqui, no nível mais alto que precisa dele, e não em contexto
 * global.
 */
export function WorkspaceShell({
  activeOrganization,
  memberships,
  userEmail,
  isSuperAdmin = false,
  children,
}: {
  activeOrganization: MembershipSummary;
  memberships: MembershipSummary[];
  userEmail: string | null;
  isSuperAdmin?: boolean;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--ff-bg-canvas)]">
      <AppSidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isSuperAdmin={isSuperAdmin}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          activeOrganization={activeOrganization}
          memberships={memberships}
          userEmail={userEmail}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
