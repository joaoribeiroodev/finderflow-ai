"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { organizationProfileSchema } from "@/lib/validation/organization-profile";
import { upsertOrganizationProfile } from "@/modules/organizations/profile.service";
import { logger } from "@/lib/logger/logger";

export interface ProfileActionResult {
  success: boolean;
  message?: string;
}

/**
 * Salva o "Perfil" cadastral da organização (Fase 9) — dados não
 * sensíveis (nome, WhatsApp, pitch) usados pela IA para personalizar a
 * prospecção por e-mail (ver `modules/ai/prompts.ts`). Qualquer membro
 * com permissão de edição pode manter isso em dia, diferente das
 * credenciais de API (owner/admin apenas).
 */
export async function saveOrganizationProfileAction(
  _prev: ProfileActionResult,
  formData: FormData,
): Promise<ProfileActionResult> {
  const parsed = organizationProfileSchema.safeParse({
    personType: formData.get("personType") === "individual" ? "individual" : "company",
    legalName: formData.get("legalName"),
    tradeName: formData.get("tradeName"),
    document: formData.get("document"),
    senderName: formData.get("senderName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    whatsappNumber: formData.get("whatsappNumber"),
    website: formData.get("website"),
    addressCity: formData.get("addressCity"),
    addressState: formData.get("addressState"),
    pitch: formData.get("pitch"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const org = await requireActiveOrganization();
  const supabase = await createClient();

  try {
    await assertCanEditOrganization(supabase, org.organizationId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    throw error;
  }

  try {
    await upsertOrganizationProfile(supabase, org.organizationId, parsed.data);
  } catch (error) {
    logger.error("Falha ao salvar perfil da organização", {
      error: (error as Error).message,
      organizationId: org.organizationId,
    });
    return { success: false, message: "Não foi possível salvar o perfil." };
  }

  revalidatePath("/settings");
  return { success: true, message: "Perfil salvo com sucesso." };
}
