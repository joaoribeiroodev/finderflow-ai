"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createOrganizationSchema } from "@/lib/validation/organizations";

import { createOrganization } from "./organizations.service";
import { setActiveOrganizationCookie } from "./active-organization";

export interface OrganizationActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createOrganizationAction(
  _prev: OrganizationActionResult,
  formData: FormData,
): Promise<OrganizationActionResult> {
  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  let organizationId: string;
  try {
    organizationId = await createOrganization(supabase, parsed.data);
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Não foi possível criar a organização.",
    };
  }

  await setActiveOrganizationCookie(organizationId);
  redirect("/dashboard");
}

export async function switchActiveOrganizationAction(formData: FormData) {
  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string" || organizationId.length === 0) {
    return;
  }

  // A validação de pertencimento ocorre em `resolveActiveOrganization()`
  // na próxima leitura — se o id não pertencer ao usuário, é ignorado e
  // a primeira organização válida é usada no lugar.
  await setActiveOrganizationCookie(organizationId);
  redirect("/dashboard");
}
