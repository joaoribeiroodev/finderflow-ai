import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/modules/organizations/organizations.service";
import {
  approveOrganizationFormAction,
  listAllUsersForAdmin,
  listOrganizationsForReview,
  listRecentLoginAttempts,
  listRecentSystemLogs,
  rejectOrganizationFormAction,
  type AdminUserRow,
  type LoginAttemptRow,
  type OrganizationReviewRow,
  type SystemLogRow,
} from "@/modules/admin/actions";

export const metadata: Metadata = { title: "Painel admin — FinderFlow AI" };

function statusBadge(status: OrganizationReviewRow["approvalStatus"]) {
  if (status === "approved") return <Badge variant="success">Aprovada</Badge>;
  if (status === "rejected") return <Badge variant="danger">Rejeitada</Badge>;
  return <Badge variant="warning">Pendente</Badge>;
}

function OrganizationRow({ org }: { org: OrganizationReviewRow }) {
  return (
    <li className="flex flex-col gap-2 border-b border-[var(--ff-border-subtle)] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <p className="font-medium text-[var(--ff-text-primary)]">{org.name}</p>
          {statusBadge(org.approvalStatus)}
        </div>
        <p className="text-xs text-[var(--ff-text-muted)]">
          /{org.slug} · criada em {new Date(org.createdAt).toLocaleDateString("pt-BR")}
        </p>
        <p className="text-xs text-[var(--ff-text-muted)]">
          Dono: {org.ownerName ?? "—"}
          {org.ownerEmail ? ` · ${org.ownerEmail}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {org.approvalStatus !== "approved" ? (
          <form action={approveOrganizationFormAction}>
            <input type="hidden" name="organizationId" value={org.id} />
            <Button type="submit" size="sm">
              Aprovar
            </Button>
          </form>
        ) : null}
        {org.approvalStatus !== "rejected" ? (
          <form action={rejectOrganizationFormAction}>
            <input type="hidden" name="organizationId" value={org.id} />
            <Button type="submit" size="sm" variant="secondary">
              Rejeitar
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function OrganizationsSection({ organizations }: { organizations: OrganizationReviewRow[] }) {
  const pending = organizations.filter((o) => o.approvalStatus === "pending");
  const reviewed = organizations.filter((o) => o.approvalStatus !== "pending");

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title={`Pendentes (${pending.length})`}
          subtitle="Cadastros recentes aguardando aprovação."
        />
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--ff-text-muted)]">Nenhuma organização pendente.</p>
        ) : (
          <ul>
            {pending.map((org) => (
              <OrganizationRow key={org.id} org={org} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Já revisadas" subtitle="Organizações aprovadas ou rejeitadas." />
        {reviewed.length === 0 ? (
          <p className="text-sm text-[var(--ff-text-muted)]">Nenhuma organização revisada ainda.</p>
        ) : (
          <ul>
            {reviewed.map((org) => (
              <OrganizationRow key={org.id} org={org} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function UserRow({ user }: { user: AdminUserRow }) {
  return (
    <li className="flex flex-col gap-1 border-b border-[var(--ff-border-subtle)] py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-[var(--ff-text-primary)]">
          {user.fullName ?? user.email ?? user.id}
        </p>
        {user.isSuperAdmin ? <Badge variant="success">Super admin</Badge> : null}
      </div>
      <p className="text-xs text-[var(--ff-text-muted)]">
        {user.email ?? "e-mail indisponível"} · desde{" "}
        {new Date(user.createdAt).toLocaleDateString("pt-BR")}
      </p>
      {user.memberships.length > 0 ? (
        <p className="text-xs text-[var(--ff-text-muted)]">
          {user.memberships
            .map((m) => `${m.organizationName} (${m.role}${m.approvalStatus !== "approved" ? ` · ${m.approvalStatus}` : ""})`)
            .join(" · ")}
        </p>
      ) : (
        <p className="text-xs text-[var(--ff-text-muted)]">Sem organização.</p>
      )}
    </li>
  );
}

function UsersSection({ users }: { users: AdminUserRow[] }) {
  return (
    <Card>
      <CardHeader
        title={`Usuários (${users.length})`}
        subtitle="Todas as contas criadas na plataforma, com suas organizações e papéis."
      />
      {users.length === 0 ? (
        <p className="text-sm text-[var(--ff-text-muted)]">Nenhum usuário encontrado.</p>
      ) : (
        <ul>
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function LogsSection({
  systemLogs,
  loginAttempts,
}: {
  systemLogs: SystemLogRow[];
  loginAttempts: LoginAttemptRow[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title={`Erros e avisos recentes (${systemLogs.length})`}
          subtitle="Últimas falhas registradas pelo sistema (ex.: integrações, ações do servidor)."
        />
        {systemLogs.length === 0 ? (
          <p className="text-sm text-[var(--ff-text-muted)]">Nenhum erro registrado ainda.</p>
        ) : (
          <ul>
            {systemLogs.map((log) => (
              <li
                key={log.id}
                className="flex flex-col gap-1 border-b border-[var(--ff-border-subtle)] py-3 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={log.level === "error" ? "danger" : "warning"}>{log.level}</Badge>
                  <p className="text-sm text-[var(--ff-text-primary)]">{log.message}</p>
                </div>
                <p className="text-xs text-[var(--ff-text-muted)]">
                  {new Date(log.createdAt).toLocaleString("pt-BR")}
                </p>
                {log.context && Object.keys(log.context as object).length > 0 ? (
                  <pre className="overflow-x-auto rounded-[var(--ff-radius-sm)] bg-[var(--ff-bg-canvas)] p-2 text-[11px] text-[var(--ff-text-muted)]">
                    {JSON.stringify(log.context, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={`Tentativas de login (${loginAttempts.length})`}
          subtitle="Últimas tentativas de login, sucesso ou falha — útil para investigar bloqueios temporários."
        />
        {loginAttempts.length === 0 ? (
          <p className="text-sm text-[var(--ff-text-muted)]">Nenhuma tentativa registrada ainda.</p>
        ) : (
          <ul>
            {loginAttempts.map((attempt) => (
              <li
                key={attempt.id}
                className="flex items-center justify-between gap-2 border-b border-[var(--ff-border-subtle)] py-2 text-sm last:border-0"
              >
                <span className="text-[var(--ff-text-primary)]">{attempt.email}</span>
                <span className="flex items-center gap-2">
                  <Badge variant={attempt.succeeded ? "success" : "danger"}>
                    {attempt.succeeded ? "Sucesso" : "Falha"}
                  </Badge>
                  <span className="text-xs text-[var(--ff-text-muted)]">
                    {new Date(attempt.createdAt).toLocaleString("pt-BR")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default async function AdminPage() {
  const supabase = await createClient();
  const isSuperAdmin = await isCurrentUserSuperAdmin(supabase);
  if (!isSuperAdmin) {
    redirect("/dashboard");
  }

  const [organizations, users, systemLogs, loginAttempts] = await Promise.all([
    listOrganizationsForReview(),
    listAllUsersForAdmin(),
    listRecentSystemLogs(100),
    listRecentLoginAttempts(100),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Super admin"
        title="Painel administrativo"
        subtitle="Gestão de usuários, aprovação de organizações e acompanhamento de logs da plataforma."
      />

      <AdminTabs
        tabs={[
          {
            key: "organizations",
            label: `Organizações${organizations.some((o) => o.approvalStatus === "pending") ? " ●" : ""}`,
            content: <OrganizationsSection organizations={organizations} />,
          },
          { key: "users", label: "Usuários", content: <UsersSection users={users} /> },
          {
            key: "logs",
            label: "Logs",
            content: <LogsSection systemLogs={systemLogs} loginAttempts={loginAttempts} />,
          },
        ]}
      />
    </div>
  );
}
