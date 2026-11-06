import type { Metadata } from "next";
import { Building2, Shield, Users, Plug, Lock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { getOrganizationIntegrationStatus } from "@/modules/organizations/credentials.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import {
  AsaasCredentialsForm,
  OpenAiCredentialsForm,
} from "@/components/settings/integration-credentials-form";

export const metadata: Metadata = { title: "Configurações — FinderFlow AI" };

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gerente",
  member: "Membro",
  viewer: "Visualizador",
};

export default async function SettingsPage() {
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const [{ data: organization, error: orgError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("name, slug, timezone, created_at")
        .eq("id", activeOrganization.organizationId)
        .single(),
      supabase
        .from("organization_members")
        .select("id, role, status, user_id, created_at")
        .eq("organization_id", activeOrganization.organizationId)
        .order("created_at", { ascending: true }),
    ]);

  // `profiles` não tem FK direta para `organization_members` (ambas referenciam
  // auth.users separadamente), então o embed do PostgREST não funciona — e a
  // policy `profiles_select_self` só deixa cada usuário ver o próprio perfil
  // mesmo assim. Buscamos à parte e mesclamos; nomes de outros membros vêm
  // como `null` até existir uma política/visão dedicada de equipe.
  const memberUserIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } =
    memberUserIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", memberUserIds)
      : { data: [] as { id: string; full_name: string | null }[] };
  const fullNameByUserId = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const integrationStatus = await getOrganizationIntegrationStatus(
    supabase,
    activeOrganization.organizationId,
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Workspace"
        title="Configurações"
        subtitle="Organização, equipe, integrações e preferências."
      />

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Building2 className="size-4 text-[var(--ff-violet-glow)]" aria-hidden /> Organização
            </span>
          }
          subtitle="Nome, identificador e timezone padrão"
        />
        {orgError || !organization ? (
          <ErrorState description="Não foi possível carregar os dados da organização." />
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-[var(--ff-text-muted)]">Nome</dt>
              <dd className="mt-1 text-sm text-[var(--ff-text-primary)]">{organization.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--ff-text-muted)]">Identificador</dt>
              <dd className="mt-1 text-sm text-[var(--ff-text-primary)]">{organization.slug}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--ff-text-muted)]">Timezone</dt>
              <dd className="mt-1 text-sm text-[var(--ff-text-primary)]">{organization.timezone}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Users className="size-4 text-[var(--ff-violet-glow)]" aria-hidden /> Equipe e permissões
            </span>
          }
          subtitle={`${members?.length ?? 0} membro(s) nesta organização`}
        />
        {membersError ? (
          <ErrorState description="Não foi possível carregar os membros." />
        ) : (
          <ul className="flex flex-col divide-y divide-[#2d243c]">
            {(members ?? []).map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="truncate text-[var(--ff-text-primary)]">
                  {fullNameByUserId.get(member.user_id) ?? `Membro ${member.user_id.slice(0, 8)}`}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {member.status !== "active" ? (
                    <Badge variant="warning">{member.status}</Badge>
                  ) : null}
                  <Badge variant="outline">{ROLE_LABELS[member.role] ?? member.role}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-[var(--ff-text-muted)]">
          Nomes de outros membros só aparecem quando o próprio usuário já preencheu o perfil — o
          convite e a edição de papéis de equipe serão implementados em uma fase futura de
          colaboração.
        </p>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Plug className="size-4 text-[var(--ff-violet-glow)]" aria-hidden /> Integrações
            </span>
          }
          subtitle="Cada organização usa sua própria conta — nenhuma chave é compartilhada entre organizações"
        />
        <AsaasCredentialsForm
          configured={integrationStatus.asaasConfigured}
          environment={integrationStatus.asaasEnvironment}
        />
        <OpenAiCredentialsForm
          configured={integrationStatus.openaiConfigured}
          model={integrationStatus.openaiModel}
        />
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Lock className="size-4 text-[var(--ff-violet-glow)]" aria-hidden /> Privacidade e
              segurança
            </span>
          }
          subtitle="Dados, retenção, exportação e supressão"
          action={<Badge variant="outline">Fase 8</Badge>}
        />
        <p className="flex items-start gap-2 text-sm text-[var(--ff-text-secondary)]">
          <Shield className="mt-0.5 size-4 shrink-0 text-[var(--ff-text-muted)]" aria-hidden />
          Isolamento entre organizações já é garantido por Row Level Security no banco (verificado
          na Fase 1). Exportação/supressão de dados e políticas de retenção detalhadas serão
          implementadas no hardening da Fase 8.
        </p>
      </Card>
    </div>
  );
}
