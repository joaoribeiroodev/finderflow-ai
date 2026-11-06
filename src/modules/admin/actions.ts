"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";
import { isCurrentUserSuperAdmin } from "@/modules/organizations/organizations.service";
import { notifyUsers } from "@/modules/notifications/notifications.service";
import type { ApprovalStatus } from "@/types/database";

export interface OrganizationReviewRow {
  id: string;
  name: string;
  slug: string;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
}

/**
 * Lista organizações para o painel /admin. Depende das policies
 * `organizations_select_super_admin` / `members_select_super_admin` /
 * `profiles_select_super_admin` (Fase 9) — quem chama sem ser super
 * admin simplesmente não vê nada além das próprias organizações.
 *
 * O e-mail do owner não existe em `public.*` (vem de `auth.users`), por
 * isso é um best-effort via cliente admin — se `SUPABASE_SERVICE_ROLE_KEY`
 * ainda não estiver configurada, a lista funciona normalmente só sem
 * e-mail.
 */
export async function listOrganizationsForReview(): Promise<OrganizationReviewRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, approval_status, created_at, organization_members ( role, user_id )")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar organizações para o painel admin", { error: error.message });
    throw new Error("Não foi possível carregar as organizações.");
  }

  const rawRows = (data ?? []).map((row) => {
    const owner = row.organization_members?.find((m) => m.role === "owner");
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      approvalStatus: row.approval_status as ApprovalStatus,
      createdAt: row.created_at,
      ownerUserId: owner?.user_id ?? null,
    };
  });

  const ownerIds = rawRows.map((r) => r.ownerUserId).filter((id): id is string => Boolean(id));
  const namesByUserId = new Map<string, string | null>();
  if (ownerIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    for (const p of profileRows ?? []) {
      namesByUserId.set(p.id, p.full_name);
    }
  }

  const rows = rawRows.map((row) => ({
    ...row,
    ownerName: row.ownerUserId ? namesByUserId.get(row.ownerUserId) ?? null : null,
    ownerEmail: null as string | null,
  }));

  try {
    const admin = createAdminClient();
    await Promise.all(
      rows.map(async (row) => {
        if (!row.ownerUserId) return;
        const { data: userData } = await admin.auth.admin.getUserById(row.ownerUserId);
        row.ownerEmail = userData?.user?.email ?? null;
      }),
    );
  } catch {
    // Service role ainda não configurada — segue sem e-mail do owner.
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    approvalStatus: row.approvalStatus,
    createdAt: row.createdAt,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
  }));
}

export interface AdminActionResult {
  success: boolean;
  message?: string;
}

async function reviewOrganization(organizationId: string, decision: "approved" | "rejected") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Não autenticado.");
  }

  // Autorização real é a RLS policy `organizations_update_super_admin` —
  // se quem chamar não for super admin, 0 linhas são afetadas.
  const { data, error } = await supabase
    .from("organizations")
    .update({
      approval_status: decision,
      approval_reviewed_by: user.id,
      approval_reviewed_at: new Date().toISOString(),
    })
    .eq("id", organizationId)
    .select("id");

  if (error) {
    logger.error("Falha ao revisar organização", { error: error.message, organizationId, decision });
    throw new Error("Não foi possível atualizar a organização.");
  }

  if (!data || data.length === 0) {
    throw new Error("Você não tem permissão para revisar organizações.");
  }

  // Notifica os membros ativos da organização revisada — melhor esforço,
  // nunca bloqueia a aprovação/rejeição em si se falhar.
  const { data: memberRows } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  const memberIds = (memberRows ?? []).map((m) => m.user_id);
  if (memberIds.length > 0) {
    await notifyUsers(organizationId, memberIds, {
      type: decision === "approved" ? "organization_approved" : "organization_rejected",
      title: decision === "approved" ? "Organização aprovada" : "Organização rejeitada",
      body:
        decision === "approved"
          ? "Sua organização foi aprovada e já pode usar o FinderFlow AI normalmente."
          : "Sua organização foi rejeitada pelo administrador da plataforma.",
    });
  }

  revalidatePath("/admin");
}

export async function approveOrganizationFormAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return;
  await reviewOrganization(organizationId, "approved");
}

export async function rejectOrganizationFormAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return;
  await reviewOrganization(organizationId, "rejected");
}

export interface AdminUserMembership {
  organizationName: string;
  organizationSlug: string;
  role: string;
  approvalStatus: ApprovalStatus;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  fullName: string | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  memberships: AdminUserMembership[];
}

/**
 * Lista todos os usuários da plataforma para o painel /admin — gestão de
 * usuários independente da aprovação de organizações. Perfis e
 * memberships vêm via RLS (`profiles_select_super_admin` /
 * `members_select_super_admin`), e-mail é best-effort via cliente admin
 * (auth.users não tem policy de leitura client-side).
 */
export async function listAllUsersForAdmin(): Promise<AdminUserRow[]> {
  const supabase = await createClient();

  const [{ data: profiles, error: profilesError }, { data: memberRows, error: membersError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, is_super_admin, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_members")
        .select("user_id, role, organizations ( name, slug, approval_status )"),
    ]);

  if (profilesError) {
    logger.error("Falha ao listar perfis para o painel admin", { error: profilesError.message });
    throw new Error("Não foi possível carregar os usuários.");
  }
  if (membersError) {
    logger.error("Falha ao listar memberships para o painel admin", {
      error: membersError.message,
    });
  }

  const membershipsByUserId = new Map<string, AdminUserMembership[]>();
  for (const row of memberRows ?? []) {
    if (!row.organizations) continue;
    const list = membershipsByUserId.get(row.user_id) ?? [];
    list.push({
      organizationName: row.organizations.name,
      organizationSlug: row.organizations.slug,
      role: row.role,
      approvalStatus: row.organizations.approval_status as ApprovalStatus,
    });
    membershipsByUserId.set(row.user_id, list);
  }

  const rows: AdminUserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: null,
    fullName: p.full_name,
    isSuperAdmin: p.is_super_admin,
    isActive: true,
    createdAt: p.created_at,
    memberships: membershipsByUserId.get(p.id) ?? [],
  }));

  try {
    const admin = createAdminClient();
    await Promise.all(
      rows.map(async (row) => {
        const { data: userData } = await admin.auth.admin.getUserById(row.id);
        row.email = userData?.user?.email ?? null;
        const bannedUntil = userData?.user?.banned_until;
        row.isActive = !bannedUntil || new Date(bannedUntil).getTime() <= Date.now();
      }),
    );
  } catch {
    // Service role ainda não configurada — segue sem e-mail e como ativo.
  }

  return rows;
}

/**
 * Autoriza a ação no código (não na RLS) — mesma observação das demais
 * funções do painel admin que usam o cliente com service role. Retorna
 * o id do usuário autenticado para checagens de "não mexer na própria
 * conta" (evitar que o super admin se desative ou se rebaixe por
 * engano e fique trancado para fora do próprio painel).
 */
async function requireSuperAdminActor(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const isSuperAdmin = await isCurrentUserSuperAdmin(supabase);
  if (!isSuperAdmin) throw new Error("Você não tem permissão para esta ação.");

  return user.id;
}

/**
 * Ativa/desativa uma conta via `ban_duration` do GoTrue — o Supabase Auth
 * já bloqueia login sozinho enquanto `banned_until` estiver no futuro,
 * então não precisa de nenhuma checagem extra em `middleware`/layout.
 */
export async function setUserActiveAction(userId: string, active: boolean): Promise<AdminActionResult> {
  try {
    const actorId = await requireSuperAdminActor();
    if (!active && userId === actorId) {
      return { success: false, message: "Você não pode desativar a sua própria conta." };
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? "none" : "876000h",
    });

    if (error) {
      logger.error("Falha ao alterar status do usuário", { error: error.message, userId });
      return { success: false, message: "Não foi possível alterar o status do usuário." };
    }

    revalidatePath("/admin");
    return { success: true, message: active ? "Usuário reativado." : "Usuário desativado." };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

/**
 * Define uma nova senha para o usuário (reset administrativo — útil
 * para suporte quando a pessoa perdeu acesso ao e-mail de recuperação).
 */
export async function setUserPasswordAction(
  userId: string,
  newPassword: string,
): Promise<AdminActionResult> {
  try {
    await requireSuperAdminActor();

    if (newPassword.length < 8) {
      return { success: false, message: "A senha precisa ter pelo menos 8 caracteres." };
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });

    if (error) {
      logger.error("Falha ao redefinir senha do usuário", { error: error.message, userId });
      return { success: false, message: "Não foi possível redefinir a senha." };
    }

    revalidatePath("/admin");
    return { success: true, message: "Senha atualizada." };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

/**
 * Concede/revoga o papel de super admin da plataforma. Passa pelo
 * cliente com service role de propósito — a coluna `profiles.is_super_admin`
 * é protegida por trigger (`protect_is_super_admin`) contra qualquer
 * update que não venha da service role, fechando a brecha onde
 * `profiles_update_self` deixava qualquer usuário se auto-promover.
 */
export async function setUserSuperAdminAction(
  userId: string,
  isSuperAdmin: boolean,
): Promise<AdminActionResult> {
  try {
    const actorId = await requireSuperAdminActor();
    if (!isSuperAdmin && userId === actorId) {
      return { success: false, message: "Você não pode remover seu próprio acesso de super admin." };
    }

    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update({ is_super_admin: isSuperAdmin }).eq("id", userId);

    if (error) {
      logger.error("Falha ao alterar papel de super admin", { error: error.message, userId });
      return { success: false, message: "Não foi possível alterar o papel do usuário." };
    }

    revalidatePath("/admin");
    return {
      success: true,
      message: isSuperAdmin ? "Usuário agora é super admin." : "Acesso de super admin removido.",
    };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

export interface SystemLogRow {
  id: string;
  level: "warn" | "error";
  message: string;
  context: unknown;
  createdAt: string;
}

/**
 * Lista os logs recentes de erro/warning da aplicação (`system_error_logs`,
 * gravados pelo logger estruturado) para a aba "Logs" do painel admin.
 * Essa tabela não tem policy nenhuma para `authenticated`/`anon` — só o
 * cliente admin lê — então a autorização real é este `isCurrentUserSuperAdmin`
 * checado aqui em código, e não a RLS.
 */
export async function listRecentSystemLogs(limit = 100): Promise<SystemLogRow[]> {
  const supabase = await createClient();
  const isSuperAdmin = await isCurrentUserSuperAdmin(supabase);
  if (!isSuperAdmin) return [];

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("system_error_logs")
      .select("id, level, message, context, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("Falha ao listar logs do sistema", { error: error.message });
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      level: row.level as "warn" | "error",
      message: row.message,
      context: row.context,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export interface LoginAttemptRow {
  id: string;
  email: string;
  succeeded: boolean;
  createdAt: string;
}

/**
 * Lista as tentativas de login recentes (`auth_login_attempts`) — útil
 * para investigar bloqueios temporários e tentativas de força bruta.
 * Mesma observação de autorização que `listRecentSystemLogs`.
 */
export async function listRecentLoginAttempts(limit = 100): Promise<LoginAttemptRow[]> {
  const supabase = await createClient();
  const isSuperAdmin = await isCurrentUserSuperAdmin(supabase);
  if (!isSuperAdmin) return [];

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("auth_login_attempts")
      .select("id, email, succeeded, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("Falha ao listar tentativas de login", { error: error.message });
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      succeeded: row.succeeded,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}
