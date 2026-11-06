import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { ApprovalStatus, Database, OrgRole } from "@/types/database";

export interface MembershipSummary {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: OrgRole;
  approvalStatus: ApprovalStatus;
}

type Supabase = SupabaseClient<Database>;

/**
 * Lista as organizações às quais o usuário autenticado pertence.
 * Depende exclusivamente de RLS (`organization_members_select_member` /
 * `organizations_select_member`) — nunca recebe `organization_id` como
 * parâmetro externo.
 */
export async function listUserMemberships(supabase: Supabase): Promise<MembershipSummary[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organization_id, organizations ( id, name, slug, approval_status )")
    .eq("status", "active");

  if (error) {
    logger.error("Falha ao listar memberships do usuário", {
      error: error.message,
    });
    throw new Error("Não foi possível carregar suas organizações.");
  }

  return (data ?? [])
    .filter(
      (
        row,
      ): row is typeof row & {
        organizations: { id: string; name: string; slug: string; approval_status: string };
      } => row.organizations !== null,
    )
    .map((row) => ({
      organizationId: row.organizations.id,
      organizationName: row.organizations.name,
      organizationSlug: row.organizations.slug,
      role: row.role,
      approvalStatus: row.organizations.approval_status as ApprovalStatus,
    }));
}

/**
 * Indica se o usuário autenticado é super admin da plataforma (Fase 9) —
 * acesso liberado a todas as organizações e ao painel /admin,
 * independente do approval_status da própria organização. Nunca lança:
 * sem sessão ou sem profile, retorna `false`.
 */
export async function isCurrentUserSuperAdmin(supabase: Supabase): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_super_admin");
  if (error) {
    logger.error("Falha ao verificar super admin", { error: error.message });
    return false;
  }
  return Boolean(data);
}

/**
 * Cria uma nova organização com o usuário autenticado como owner e as
 * etapas de pipeline padrão, via função transacional `SECURITY DEFINER`
 * no banco (evita condição de corrida entre criar org + membership).
 */
export async function createOrganization(
  supabase: Supabase,
  input: { name: string; slug: string },
): Promise<string> {
  const { data, error } = await supabase.rpc("create_organization_with_defaults", {
    org_name: input.name,
    org_slug: input.slug,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Esse identificador de organização já está em uso.");
    }
    logger.error("Falha ao criar organização", { error: error.message });
    throw new Error("Não foi possível criar a organização.");
  }

  return data;
}
