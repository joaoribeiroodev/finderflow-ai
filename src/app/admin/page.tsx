import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  approveOrganizationFormAction,
  listOrganizationsForReview,
  rejectOrganizationFormAction,
  type OrganizationReviewRow,
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

export default async function AdminPage() {
  const organizations = await listOrganizationsForReview();
  const pending = organizations.filter((o) => o.approvalStatus === "pending");
  const reviewed = organizations.filter((o) => o.approvalStatus !== "pending");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Super admin"
        title="Painel administrativo"
        subtitle="Aprove ou rejeite novas organizações antes que elas possam usar o FinderFlow AI."
      />

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
