"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { serviceSchema } from "@/lib/validation/services";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import { createService, setServiceActive, updateService } from "./services.service";

export interface ServiceActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

function parseServiceForm(formData: FormData) {
  return serviceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    pricingType: formData.get("pricingType"),
    basePrice: formData.get("basePrice"),
    isActive: formData.get("isActive"),
  });
}

export async function createServiceAction(
  _prev: ServiceActionResult,
  formData: FormData,
): Promise<ServiceActionResult> {
  const parsed = parseServiceForm(formData);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await createService(supabase, organizationId, parsed.data);
  } catch (error) {
    return {
      success: false,
      message: error instanceof PermissionError || error instanceof Error ? error.message : "Não foi possível criar o serviço.",
    };
  }

  revalidatePath("/services");
  return { success: true, message: "Serviço criado." };
}

export async function updateServiceAction(
  _prev: ServiceActionResult,
  formData: FormData,
): Promise<ServiceActionResult> {
  const serviceId = formData.get("serviceId");
  if (typeof serviceId !== "string" || serviceId.length === 0) {
    return { success: false, message: "Serviço inválido." };
  }

  const parsed = parseServiceForm(formData);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await updateService(supabase, organizationId, serviceId, parsed.data);
  } catch (error) {
    return {
      success: false,
      message: error instanceof PermissionError || error instanceof Error ? error.message : "Não foi possível atualizar o serviço.",
    };
  }

  revalidatePath("/services");
  return { success: true, message: "Serviço atualizado." };
}

export async function toggleServiceActiveAction(formData: FormData): Promise<void> {
  const serviceId = formData.get("serviceId");
  const isActive = formData.get("isActive") === "true";
  if (typeof serviceId !== "string" || serviceId.length === 0) return;

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);
  await setServiceActive(supabase, organizationId, serviceId, isActive);

  revalidatePath("/services");
}
