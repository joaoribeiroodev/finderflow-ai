import type { Metadata } from "next";
import { Building2, Download, Shield, Users, Plug, Lock, IdCard } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { getOrganizationIntegrationStatus } from "@/modules/organizations/credentials.service";
import { getOrganizationProfile } from "@/modules/organizations/profile.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import {
  AsaasCredentialsForm,
  GmailCredentialsForm,
  OpenAiCredentialsForm,
} from "@/components/settings/integration-credentials-form";
import { OrganizationProfileForm } from "@/components/settings/organization-profile-form";
import { Button } from "@/components/ui/button";
import { DangerZone } from "@/components/settings/danger-zone";
import { TeamMembers } from "@/components/settings/team-members";

export const metadata: Metadata = { title: "Configurações — FinderFlow AI" };

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

  const [integrationStatus, organizationProfile] = await Promise.all([
    getOrganizationIntegrationStatus(supabase, activeOrganization.organizationId),
    getOrganizationProfile(supabase, activeOrganization.organizationId),
  ]);

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const canManageTeam = activeOrganization.role === "owner" || activeOrganization.role === "admin";

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
              <IdCard className="size-4 text-[var(--ff-violet-glow)]" aria-hidden /> Perfil
            </span>
          }
          subtitle="Dados cadastrais usados pela IA para personalizar e assinar os e-mails de prospecção"
        />
        <OrganizationProfileForm profile={organizationProfile} />
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
          <TeamMembers
            members={(members ?? []).map((member) => ({
              id: member.id,
              userId: member.user_id,
              role: member.role,
              status: member.status,
              name: fullNameByUserId.get(member.user_id) ?? `Membro ${member.user_id.slice(0, 8)}`,
            }))}
            canManage={canManageTeam}
            currentUserId={currentUser?.id ?? null}
          />
        )}
        <p className="mt-3 text-xs text-[var(--ff-text-muted)]">
          Nomes de outros membros só aparecem quando o próprio usuário já preencheu o perfil.
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
        <GmailCredentialsForm
          configured={integrationStatus.gmailConfigured}
          email={integrationStatus.gmailEmail}
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
          subtitle="Dados, exportação e exclusão"
        />
        <p className="mb-4 flex items-start gap-2 text-sm text-[var(--ff-text-secondary)]">
          <Shield className="mt-0.5 size-4 shrink-0 text-[var(--ff-text-muted)]" aria-hidden />
          Isolamento entre organizações é garantido por Row Level Security no banco — cada
          organização só enxerga seus próprios dados.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--ff-text-primary)]">Exportar meus dados</p>
            <p className="text-xs text-[var(--ff-text-muted)]">
              Baixe um arquivo .json com empresas, leads, propostas, contratos e todo o histórico
              desta organização.
            </p>
          </div>
          <a href="/api/v1/organizations/export" download>
            <Button type="button" size="sm" variant="secondary" className="gap-1.5">
              <Download className="size-3.5" aria-hidden />
              Exportar dados
            </Button>
          </a>
        </div>
        <DangerZone
          organizationSlug={activeOrganization.organizationSlug}
          isOwner={activeOrganization.role === "owner"}
        />
      </Card>
    </div>
  );
}
