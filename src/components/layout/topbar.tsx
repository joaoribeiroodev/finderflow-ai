"use client";

import { Bell, Menu, Search } from "lucide-react";

import type { MembershipSummary } from "@/modules/organizations/organizations.service";
import { switchActiveOrganizationAction } from "@/modules/organizations/actions";
import { logoutAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gerente",
  member: "Membro",
  viewer: "Visualizador",
};

export function Topbar({
  activeOrganization,
  memberships,
  userEmail,
  onMenuClick,
}: {
  activeOrganization: MembershipSummary;
  memberships: MembershipSummary[];
  userEmail: string | null;
  onMenuClick: () => void;
}) {
  const initials = (userEmail ?? "?").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[var(--ff-border-subtle)] bg-[#0d0a15]/85 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menu de navegação"
          aria-controls="app-sidebar"
          className="flex size-9 shrink-0 items-center justify-center rounded-[var(--ff-radius-sm)] border border-[var(--ff-border-subtle)] text-[var(--ff-text-secondary)] hover:border-[var(--ff-purple-500)] md:hidden"
        >
          <Menu className="size-[18px]" aria-hidden />
        </button>

        {memberships.length > 1 ? (
          <form action={switchActiveOrganizationAction} className="min-w-0">
            <label className="sr-only" htmlFor="organizationId">
              Organização ativa
            </label>
            <select
              id="organizationId"
              name="organizationId"
              defaultValue={activeOrganization.organizationId}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="w-full max-w-[220px] truncate rounded-[var(--ff-radius-sm)] border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-2 py-1.5 text-sm text-[var(--ff-text-primary)]"
            >
              {memberships.map((m) => (
                <option key={m.organizationId} value={m.organizationId}>
                  {m.organizationName}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <span className="truncate rounded-[var(--ff-radius-sm)] border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3 py-1.5 text-sm text-[var(--ff-text-secondary)]">
            {activeOrganization.organizationName}
          </span>
        )}

        {/* Busca global — visual nesta fase; comando ⌘K será implementado quando houver o
            que buscar de fato (empresas/leads, Fase 3/4). */}
        <div
          aria-hidden
          className="hidden min-w-0 flex-1 items-center gap-2 rounded-[var(--ff-radius-sm)] border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3 py-2 text-sm text-[var(--ff-text-muted)] md:flex md:max-w-[320px]"
        >
          <Search className="size-4 shrink-0" />
          <span className="truncate">Buscar no sistema...</span>
          <span className="ml-auto text-xs text-[var(--ff-text-muted)]">⌘K</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled
          aria-disabled
          title="Notificações — em breve"
          className="flex size-9 items-center justify-center rounded-[var(--ff-radius-sm)] text-[var(--ff-text-muted)] opacity-60"
        >
          <Bell className="size-[18px]" aria-hidden />
          <span className="sr-only">Notificações (em breve)</span>
        </button>

        <span className="hidden text-sm text-[var(--ff-text-muted)] sm:inline">
          {ROLE_LABELS[activeOrganization.role] ?? activeOrganization.role}
        </span>

        <span
          title={userEmail ?? undefined}
          className="flex size-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#d946ef)] text-xs font-bold text-white"
        >
          {initials}
        </span>

        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sair
          </Button>
        </form>
      </div>
    </header>
  );
}
