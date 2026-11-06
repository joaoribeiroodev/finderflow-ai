"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger/logger";
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
