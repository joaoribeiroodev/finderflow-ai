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
}: {
  activeOrganization: MembershipSummary;
  memberships: MembershipSummary[];
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--ff-border-subtle)] bg-[var(--ff-bg-sidebar)] px-6">
      <div className="flex items-center gap-3">
        <span className="bg-gradient-to-r from-[var(--ff-purple-500)] to-[var(--ff-magenta)] bg-clip-text text-lg font-bold text-transparent">
          FinderFlow AI
        </span>
        {memberships.length > 1 ? (
          <form action={switchActiveOrganizationAction}>
            <select
              name="organizationId"
              defaultValue={activeOrganization.organizationId}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="rounded-lg border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-2 py-1 text-sm text-[var(--ff-text-primary)]"
            >
              {memberships.map((m) => (
                <option key={m.organizationId} value={m.organizationId}>
                  {m.organizationName}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <span className="rounded-lg border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3 py-1 text-sm text-[var(--ff-text-secondary)]">
            {activeOrganization.organizationName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-[var(--ff-text-muted)]">
          {ROLE_LABELS[activeOrganization.role] ?? activeOrganization.role}
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
