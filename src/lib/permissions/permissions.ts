import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, OrgRole } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export const ROLE_RANK: Record<OrgRole, number> = {
  viewer: 0,
  member: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export function roleAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * Revalida no banco (via RPC `SECURITY DEFINER`) se o usuário autenticado
 * pode editar dados de negócio da organização. Usar em toda Server Action
 * que grava dados, mesmo que a RLS também proteja a tabela-alvo —
 * defesa em profundidade, e mensagens de erro mais claras.
 */
export async function assertCanEditOrganization(
  supabase: Supabase,
  organizationId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("can_edit_org", {
    target_org: organizationId,
  });

  if (error || !data) {
    throw new PermissionError("Você não tem permissão para editar dados desta organização.");
  }
}

/** Revalida se o usuário autenticado é admin/owner da organização. */
export async function assertCanAdminOrganization(
  supabase: Supabase,
  organizationId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("can_admin_org", {
    target_org: organizationId,
  });

  if (error || !data) {
    throw new PermissionError("Apenas administradores da organização podem realizar esta ação.");
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}
