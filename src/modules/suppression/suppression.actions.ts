"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { logAudit } from "@/lib/audit/audit-log";
import { logger } from "@/lib/logger/logger";

export interface SuppressionActionResult {
  success: boolean;
  message?: string;
}

/**
 * Adiciona uma entrada manual à lista de supressão — ex.: alguém pediu
 * por telefone/e-mail para não ser mais contatado, antes de existir
 * qualquer canal automático de descadastro (campanhas/cadências ainda
 * não implementados). A normalização e a deduplicação por organização
 * são feitas no banco (coluna gerada `normalized_value` + unique index).
 */
export async function addSuppressionEntryAction(
  _prev: SuppressionActionResult,
  formData: FormData,
): Promise<SuppressionActionResult> {
  const contactType = String(formData.get("contactType") ?? "");
  const contactValue = String(formData.get("contactValue") ?? "").trim();
  const reason = String(formData.get("reason") ?? "manual");

  if (contactType !== "email" && contactType !== "phone") {
    return { success: false, message: "Selecione e-mail ou telefone." };
  }
  if (!contactValue) {
    return { success: false, message: "Informe o contato a suprimir." };
  }
  if (contactType === "email" && !contactValue.includes("@")) {
    return { success: false, message: "Informe um e-mail válido." };
  }

  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("suppression_entries").insert({
    organization_id: org.organizationId,
    contact_type: contactType,
    contact_value: contactValue,
    reason: ["opt_out", "bounce", "complaint", "manual"].includes(reason) ? reason : "manual",
    source: "manual",
    created_by: user?.id ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, message: "Este contato já está na lista de supressão." };
    }
    logger.error("Falha ao adicionar entrada de supressão", {
      error: error.message,
      organizationId: org.organizationId,
    });
    return { success: false, message: "Não foi possível adicionar à lista de supressão." };
  }

  await logAudit({
    organizationId: org.organizationId,
    actorId: user?.id ?? null,
    action: "suppression_entry.create",
    resourceType: "suppression_entries",
    metadata: { contactType },
  });

  revalidatePath("/settings");
  return { success: true, message: "Contato adicionado à lista de supressão." };
}

export async function removeSuppressionEntryAction(formData: FormData): Promise<void> {
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return;

  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Autorização real é a RLS policy `suppression_entries_delete_admin`
  // (owner/admin) — se quem chamar não tiver o papel, 0 linhas são
  // afetadas e a remoção simplesmente não acontece.
  const { error, count } = await supabase
    .from("suppression_entries")
    .delete({ count: "exact" })
    .eq("id", entryId)
    .eq("organization_id", org.organizationId);

  if (error) {
    logger.error("Falha ao remover entrada de supressão", {
      error: error.message,
      organizationId: org.organizationId,
      entryId,
    });
    return;
  }

  if (count && count > 0) {
    await logAudit({
      organizationId: org.organizationId,
      actorId: user?.id ?? null,
      action: "suppression_entry.delete",
      resourceType: "suppression_entries",
      resourceId: entryId,
    });
  }

  revalidatePath("/settings");
}
