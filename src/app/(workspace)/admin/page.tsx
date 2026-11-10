import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { UserAdminActions } from "@/components/admin/user-admin-actions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatRelativeDateTime } from "@/lib/utils/format";
import { isCurrentUserSuperAdmin } from "@/modules/organizations/organizations.service";
import {
  approveOrganizationFormAction,
  getQueueHealth,
  listAllUsersForAdmin,
  listOrganizationsForReview,
  listRecentLoginAttempts,
  listRecentSystemLogs,
  rejectOrganizationFormAction,
  type AdminUserRow,
  type LoginAttemptRow,
  type OrganizationReviewRow,
  type QueueHealth,
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
          /{org.slug} · criada em {formatDate(org.createdAt)}
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

function UserRow({ user, currentUserId }: { user: AdminUserRow; currentUserId: string }) {
  return (
    <li className="flex flex-col gap-2 border-b border-[var(--ff-border-subtle)] py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-[var(--ff-text-primary)]">
          {user.fullName ?? user.email ?? user.id}
        </p>
        {user.isSuperAdmin ? <Badge variant="success">Super admin</Badge> : null}
        {!user.isActive ? <Badge variant="danger">Desativado</Badge> : null}
        {user.id === currentUserId ? <Badge variant="outline">Você</Badge> : null}
      </div>
      <p className="text-xs text-[var(--ff-text-muted)]">
        {user.email ?? "e-mail indisponível"} · desde{" "}
        {formatDate(user.createdAt)}
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
      <UserAdminActions
        userId={user.id}
        email={user.email}
        isActive={user.isActive}
        isSuperAdmin={user.isSuperAdmin}
        isSelf={user.id === currentUserId}
      />
    </li>
  );
}

function UsersSection({ users, currentUserId }: { users: AdminUserRow[]; currentUserId: string }) {
  return (
    <Card>
      <CardHeader
        title={`Usuários (${users.length})`}
        subtitle="Todas as contas criadas na plataforma — ative/desative, redefina senhas e gerencie o acesso de super admin."
      />
      {users.length === 0 ? (
        <p className="text-sm text-[var(--ff-text-muted)]">Nenhum usuário encontrado.</p>
      ) : (
        <ul>
          {users.map((user) => (
            <UserRow key={user.id} user={user} currentUserId={currentUserId} />
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
                  {formatDateTime(log.createdAt)}
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
                    {formatDateTime(attempt.createdAt)}
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

const JOB_STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "danger" | "outline" }> = {
  queued: { label: "Na fila", variant: "outline" },
  processing: { label: "Processando", variant: "warning" },
  succeeded: { label: "Concluído", variant: "success" },
  dead_letter: { label: "Falhou (esgotou tentativas)", variant: "danger" },
};

function QueueSection({ queue }: { queue: QueueHealth }) {
  if (!queue.available) {
    return (
      <Card>
        <CardHeader title="Fila de tarefas" subtitle="Envios de campanha, cadências e enriquecimento em segundo plano." />
        <p className="text-sm text-[var(--ff-text-muted)]">
          Não foi possível ler a fila. Confira se SUPABASE_SERVICE_ROLE_KEY está configurada neste ambiente.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Fila de tarefas"
          subtitle="Envios de campanha, cadências e enriquecimento em segundo plano. O banco chama o worker a cada 5 minutos."
        />
        {queue.stalled && queue.oldestDueAt ? (
          <p role="alert" className="mb-3 text-sm text-[var(--ff-danger)]">
            Há tarefas prontas esperando desde {formatDateTime(queue.oldestDueAt)} — o worker não está sendo
            chamado. Confira o agendamento (pg_cron) e a URL configurada em configure_jobs_worker.
          </p>
        ) : null}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            { label: "Na fila", value: queue.counts.queued },
            { label: "Processando", value: queue.counts.processing },
            { label: "Concluídas", value: queue.counts.succeeded },
            { label: "Falharam", value: queue.counts.deadLetter },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-[var(--ff-text-muted)]">{item.label}</dt>
              <dd className="ff-tabular-nums text-2xl font-semibold text-[var(--ff-text-primary)]">
                {item.value.toLocaleString("pt-BR")}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-xs text-[var(--ff-text-muted)]">Última conclusão</dt>
            <dd className="text-sm text-[var(--ff-text-primary)]">
              {queue.lastCompletedAt ? formatRelativeDateTime(queue.lastCompletedAt) : "Nunca"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Tarefas recentes" subtitle="As 30 mais novas, de qualquer organização." />
        {queue.recent.length === 0 ? (
          <p className="text-sm text-[var(--ff-text-muted)]">Nenhuma tarefa registrada ainda.</p>
        ) : (
          <ul>
            {queue.recent.map((job) => {
              const status = JOB_STATUS_LABEL[job.status] ?? { label: job.status, variant: "outline" as const };
              return (
                <li
                  key={job.id}
                  className="flex flex-col gap-1 border-b border-[var(--ff-border-subtle)] py-2.5 text-sm last:border-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs text-[var(--ff-text-primary)]">{job.jobType}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <span className="text-xs text-[var(--ff-text-muted)]">
                        {job.completedAt
                          ? `concluída ${formatDateTime(job.completedAt)}`
                          : `agendada para ${formatDateTime(job.runAfter)}`}
                      </span>
                    </span>
                  </div>
                  {job.lastError ? (
                    <p className="text-xs text-[var(--ff-danger)]">
                      Tentativa {job.attempts}/{job.maxAttempts}: {job.lastError}
                    </p>
                  ) : null}
                </li>
              );
            })}
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

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const [organizations, users, systemLogs, loginAttempts, queue] = await Promise.all([
    listOrganizationsForReview(),
    listAllUsersForAdmin(),
    listRecentSystemLogs(100),
    listRecentLoginAttempts(100),
    getQueueHealth(),
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
          {
            key: "users",
            label: "Usuários",
            content: <UsersSection users={users} currentUserId={currentUser?.id ?? ""} />,
          },
          {
            key: "queue",
            label: `Fila${queue.counts.deadLetter > 0 ? " ●" : ""}`,
            content: <QueueSection queue={queue} />,
          },
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
