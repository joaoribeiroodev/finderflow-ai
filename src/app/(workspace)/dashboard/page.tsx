import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

export const metadata: Metadata = { title: "Dashboard — FinderFlow AI" };

export default async function DashboardPage() {
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("organization_members")
    .select("id, role, status, user_id")
    .eq("organization_id", activeOrganization.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ff-text-primary)]">
          Bem-vindo(a), {activeOrganization.organizationName}
        </h1>
        <p className="text-sm text-[var(--ff-text-secondary)]">
          Seu papel nesta organização: {activeOrganization.role}
        </p>
      </div>

      <section className="rounded-2xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] p-6">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-[var(--ff-text-muted)] uppercase">
          Membros da organização
        </h2>
        {error ? (
          <p className="text-sm text-[var(--ff-danger)]">Não foi possível carregar os membros.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(members ?? []).map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-[var(--ff-border-subtle)] px-4 py-2 text-sm text-[var(--ff-text-primary)]"
              >
                <span>{member.user_id}</span>
                <span className="text-[var(--ff-text-muted)]">{member.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-dashed border-[var(--ff-border-subtle)] p-6 text-sm text-[var(--ff-text-muted)]">
        Prospecção, pipeline, IA e billing serão habilitados nas próximas fases (3 a 6) deste
        projeto.
      </section>
    </div>
  );
}
