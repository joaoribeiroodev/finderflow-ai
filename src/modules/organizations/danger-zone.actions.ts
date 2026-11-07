"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { logger } from "@/lib/logger/logger";
import { logAudit } from "@/lib/audit/audit-log";

export interface DeleteOrganizationResult {
  success: boolean;
  message?: string;
}

const PROPOSALS_BUCKET = "proposals";

/**
 * Exclusão completa da organização (Configurações → Privacidade e
 * segurança). Confirmação é digitar o slug exato da organização — mesmo
 * padrão "type to confirm" usado por ferramentas que fazem exclusão
 * irreversível, para evitar clique acidental num botão tão destrutivo.
 *
 * A autorização real é a função `delete_organization_cascade` no banco
 * (restrita a `owner`, revalidada lá dentro via `has_org_role` — não
 * confiamos só em checar o papel aqui). Ela cuida do cascade de todas as
 * tabelas de negócio (schema já tem `on delete cascade` em tudo) e limpa
 * os segredos no Vault. O que o banco não alcança — os PDFs de proposta
 * no Storage — é apagado aqui antes, via cliente admin.
 */
export async function deleteOrganizationAction(
  _prev: DeleteOrganizationResult,
  formData: FormData,
): Promise<DeleteOrganizationResult> {
  const confirmSlug = String(formData.get("confirmSlug") ?? "").trim();

  const supabase = await createClient();
  const { organizationId, organizationSlug, role } = await requireActiveOrganization();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (role !== "owner") {
    return { success: false, message: "Só o proprietário da organização pode excluí-la." };
  }

  if (confirmSlug !== organizationSlug) {
    return {
      success: false,
      message: `Digite exatamente "${organizationSlug}" para confirmar a exclusão.`,
    };
  }

  try {
    const admin = createAdminClient();
    const { data: files } = await admin.storage.from(PROPOSALS_BUCKET).list(organizationId);
    if (files && files.length > 0) {
      await admin.storage
        .from(PROPOSALS_BUCKET)
        .remove(files.map((f) => `${organizationId}/${f.name}`));
    }
  } catch (error) {
    // Best-effort: não bloqueia a exclusão dos dados por causa de um
    // arquivo de storage que não pôde ser limpo — fica órfão, mas não
    // alcançável (a organização nem existe mais para gerar signed URL).
    logger.error("Falha ao limpar arquivos de storage antes de excluir organização", {
      error: error instanceof Error ? error.message : "erro desconhecido",
      organizationId,
    });
  }

  const { error } = await supabase.rpc("delete_organization_cascade", { p_org: organizationId });

  if (error) {
    logger.error("Falha ao excluir organização", { error: error.message, organizationId });
    return { success: false, message: "Não foi possível excluir a organização." };
  }

  // Logado depois do cascade (não antes): `organization_id` em
  // `audit_logs` tem `on delete set null`, não cascade, então o registro
  // sobrevive à exclusão — mas só queremos registrar sucesso se o rpc
  // realmente teve sucesso.
  await logAudit({
    organizationId,
    actorId: user?.id ?? null,
    action: "organization.delete",
    resourceType: "organizations",
    resourceId: organizationId,
    metadata: { organizationSlug },
  });

  redirect("/onboarding");
}
