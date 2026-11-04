"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { companyManualSchema } from "@/lib/validation/companies";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import {
  archiveCompany,
  convertCompanyToLead,
  createCompany,
  CompanyAlreadyConvertedError,
  DuplicateCompanyError,
} from "./companies.service";

export interface CompanyActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Preenchido quando a falha foi uma duplicata avisável (não um erro de validação comum). */
  duplicateWarning?: { message: string; candidateIds: string[] };
  /** Ecoa o que foi digitado quando a submissão falha, para o form não perder os valores (Field é não-controlado). */
  values?: Record<string, string>;
}

const COMPANY_FORM_FIELDS = [
  "name",
  "cnpj",
  "category",
  "website",
  "phone",
  "email",
  "street",
  "city",
  "state",
  "zipCode",
] as const;

function echoFormValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of COMPANY_FORM_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

export async function createCompanyAction(
  _prev: CompanyActionResult,
  formData: FormData,
): Promise<CompanyActionResult> {
  const values = echoFormValues(formData);
  const parsed = companyManualSchema.safeParse({
    name: formData.get("name"),
    cnpj: formData.get("cnpj"),
    category: formData.get("category"),
    website: formData.get("website"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    street: formData.get("street"),
    city: formData.get("city"),
    state: formData.get("state"),
    zipCode: formData.get("zipCode"),
    confirmDuplicate: formData.get("confirmDuplicate"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors, values };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  // `redirect()` do Next.js lança um erro especial (digest `NEXT_REDIRECT`)
  // que o próprio framework precisa ver propagar — nunca pode ficar dentro
  // de um try/catch que o trata como falha genérica (bug clássico do App
  // Router). Por isso ele fica FORA do try abaixo.
  let companyId: string;
  try {
    await assertCanEditOrganization(supabase, organizationId);
    const company = await createCompany(supabase, organizationId, parsed.data, {
      origin: "manual",
      confirmDuplicate: parsed.data.confirmDuplicate,
    });
    companyId = company.id;
  } catch (error) {
    if (error instanceof DuplicateCompanyError) {
      return {
        success: false,
        message: error.message,
        duplicateWarning: { message: error.message, candidateIds: error.candidates.map((c) => c.id) },
        values,
      };
    }
    if (error instanceof PermissionError) {
      return { success: false, message: error.message, values };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : "Não foi possível cadastrar a empresa.",
      values,
    };
  }

  revalidatePath("/companies");
  redirect(`/companies/${companyId}`);
}

export interface SimpleActionResult {
  success: boolean;
  message?: string;
}

export async function convertToLeadAction(
  _prev: SimpleActionResult,
  formData: FormData,
): Promise<SimpleActionResult> {
  const companyId = formData.get("companyId");
  if (typeof companyId !== "string" || companyId.length === 0) {
    return { success: false, message: "Empresa inválida." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  try {
    await assertCanEditOrganization(supabase, organizationId);
    await convertCompanyToLead(supabase, organizationId, companyId);
  } catch (error) {
    if (error instanceof CompanyAlreadyConvertedError) {
      return { success: false, message: error.message };
    }
    if (error instanceof PermissionError) {
      return { success: false, message: error.message };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : "Não foi possível converter em lead.",
    };
  }

  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
  return { success: true, message: "Empresa convertida em lead." };
}

export async function archiveCompanyAction(formData: FormData): Promise<void> {
  const companyId = formData.get("companyId");
  if (typeof companyId !== "string" || companyId.length === 0) return;

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  await assertCanEditOrganization(supabase, organizationId);
  await archiveCompany(supabase, organizationId, companyId);

  revalidatePath("/companies");
  redirect("/companies");
}
