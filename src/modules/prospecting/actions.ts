"use server";

import { createClient } from "@/lib/supabase/server";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { getBusinessDataProvider, ProviderNotConfiguredError } from "@/modules/companies/providers/business-data-provider";

export interface SearchActionResult {
  success: boolean;
  message?: string;
  providerNotConfigured?: boolean;
}

/**
 * Registra a intenção de busca (`searches`) e tenta executá-la via o
 * `BusinessDataProvider` configurado. Hoje isso sempre falha com
 * `ProviderNotConfiguredError` (ver business-data-provider.ts) — a
 * action ainda assim grava a busca para já exercitar o schema e a
 * auditoria (`searches.status = 'failed'`), e devolve uma mensagem clara
 * em vez de fingir um resultado.
 */
export async function searchCompaniesAction(
  _prev: SearchActionResult,
  formData: FormData,
): Promise<SearchActionResult> {
  const query = formData.get("query");
  if (typeof query !== "string" || query.trim().length < 2) {
    return { success: false, message: "Informe o que você está buscando (ex.: 'restaurantes')." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Sessão expirada. Faça login novamente." };

  try {
    await assertCanEditOrganization(supabase, organizationId);
  } catch (error) {
    if (error instanceof PermissionError) return { success: false, message: error.message };
    throw error;
  }

  const segment = formData.get("segment");
  const state = formData.get("state");
  const city = formData.get("city");

  const { data: search, error: insertError } = await supabase
    .from("searches")
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      query: query.trim(),
      segment: typeof segment === "string" && segment.length > 0 ? segment : null,
      state: typeof state === "string" && state.length > 0 ? state.toUpperCase() : null,
      city: typeof city === "string" && city.length > 0 ? city : null,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !search) {
    return { success: false, message: "Não foi possível registrar a busca." };
  }

  try {
    const provider = getBusinessDataProvider();
    await provider.search({
      query: query.trim(),
      segment: typeof segment === "string" ? segment : undefined,
      state: typeof state === "string" ? state : undefined,
      city: typeof city === "string" ? city : undefined,
    });
    await supabase.from("searches").update({ status: "completed" }).eq("id", search.id);
    return { success: true };
  } catch (error) {
    await supabase.from("searches").update({ status: "failed" }).eq("id", search.id);
    if (error instanceof ProviderNotConfiguredError) {
      return { success: false, providerNotConfigured: true, message: error.message };
    }
    return { success: false, message: "Não foi possível buscar empresas agora." };
  }
}
