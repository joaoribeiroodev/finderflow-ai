"use client";

import { Menu } from "lucide-react";

import type { MembershipSummary } from "@/modules/organizations/organizations.service";
import type { NotificationRow } from "@/modules/notifications/notifications.service";
import { switchActiveOrganizationAction } from "@/modules/organizations/actions";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { GlobalSearch } from "@/components/layout/global-search";

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
  notifications,
  onMenuClick,
}: {
  activeOrganization: MembershipSummary;
  memberships: MembershipSummary[];
  userEmail: string | null;
  notifications: { items: NotificationRow[]; unreadCount: number };
  onMenuClick: () => void;
}) {
  const roleLabel = ROLE_LABELS[activeOrganization.role] ?? activeOrganization.role;

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

        <GlobalSearch />
      </div>

      <div className="flex items-center gap-3">
        <NotificationsBell
          organizationId={activeOrganization.organizationId}
          initialItems={notifications.items}
          initialUnreadCount={notifications.unreadCount}
        />

        <span className="hidden text-sm text-[var(--ff-text-muted)] sm:inline">{roleLabel}</span>

        <UserMenu userEmail={userEmail} roleLabel={roleLabel} />
      </div>
    </header>
  );
}
