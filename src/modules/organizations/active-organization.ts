import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import { listUserMemberships, type MembershipSummary } from "./organizations.service";

export const ACTIVE_ORG_COOKIE = "ff_active_org";

export interface ActiveOrganizationResult {
  activeOrganization: MembershipSummary | null;
  memberships: MembershipSummary[];
}

/**
 * Resolve a organização ativa do usuário autenticado, **sempre no servidor**.
 *
 * O cookie `ff_active_org` guarda apenas uma *preferência* de UI (qual
 * organização mostrar por padrão). Ele nunca é confiado diretamente: a
 * cada chamada, validamos que o usuário ainda é membro ativo dessa
 * organização consultando `organization_members` sob RLS. Se a preferência
 * for inválida (removido da org, cookie adulterado, etc.), caímos para a
 * primeira organização disponível.
 */
export async function resolveActiveOrganization(): Promise<ActiveOrganizationResult> {
  const supabase = await createClient();
  const memberships = await listUserMemberships(supabase);

  if (memberships.length === 0) {
    return { activeOrganization: null, memberships };
  }

  const cookieStore = await cookies();
  const preferredOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  const activeOrganization =
    memberships.find((m) => m.organizationId === preferredOrgId) ?? memberships[0];

  return { activeOrganization, memberships };
}

/** Define a preferência de organização ativa (apenas em Server Actions/Route Handlers). */
export async function setActiveOrganizationCookie(organizationId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/**
 * Helper para Server Actions/Route Handlers que exigem uma organização
 * ativa válida. Lança erro controlado se o usuário não tiver nenhuma —
 * o chamador deve redirecionar para /onboarding.
 */
export async function requireActiveOrganization(): Promise<MembershipSummary> {
  const { activeOrganization } = await resolveActiveOrganization();
  if (!activeOrganization) {
    throw new Error("NO_ACTIVE_ORGANIZATION");
  }
  return activeOrganization;
}
