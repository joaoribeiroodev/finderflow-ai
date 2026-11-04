"use server";

import { redirect } from "next/navigation";

import { getAsaasProvider } from "@/lib/billing/asaas-provider";
import { AsaasProviderNotConfiguredError } from "@/lib/billing/provider";
import { assertCanAdminOrganization, PermissionError } from "@/lib/permissions/permissions";
import { createClient } from "@/lib/supabase/server";
import { billingProfileSchema } from "@/lib/validation/document";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import {
  AsaasRequestFailedError,
  PlanNotFoundError,
  startCheckout,
  SubscriptionAlreadyActiveError,
} from "./checkout.service";

export interface CheckoutActionResult {
  success: boolean;
  message?: string;
  notConfigured?: boolean;
  fieldErrors?: Record<string, string[]>;
}

function mapKnownError(error: unknown): { message: string; notConfigured?: boolean } {
  if (error instanceof AsaasProviderNotConfiguredError) {
    return { message: error.message, notConfigured: true };
  }
  if (
    error instanceof PlanNotFoundError ||
    error instanceof SubscriptionAlreadyActiveError ||
    error instanceof AsaasRequestFailedError ||
    error instanceof PermissionError
  ) {
    return { message: error.message };
  }
  return { message: error instanceof Error ? error.message : "Falha inesperada ao iniciar a assinatura." };
}

/**
 * Inicia o checkout de um plano. Em sucesso, redireciona para o checkout
 * hospedado do Asaas (URL externa) — `redirect()` do Next.js suporta
 * destino externo da mesma forma que interno (emite 303 com `Location`).
 * Nunca chamado dentro de `try/catch` com `catch` genérico (regra fixa
 * do projeto desde a Fase 3 — `redirect()` lança internamente e seria
 * engolido por um catch genérico).
 */
export async function startCheckoutAction(
  _prev: CheckoutActionResult,
  formData: FormData,
): Promise<CheckoutActionResult> {
  const planId = formData.get("planId");
  if (typeof planId !== "string" || planId.length === 0) {
    return { success: false, message: "Selecione um plano." };
  }

  const parsed = billingProfileSchema.safeParse({
    billingName: formData.get("billingName"),
    billingDocument: formData.get("billingDocument"),
    billingEmail: formData.get("billingEmail"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  let checkoutUrl: string;
  try {
    await assertCanAdminOrganization(supabase, organizationId);
    const provider = getAsaasProvider();
    const result = await startCheckout(supabase, provider, organizationId, planId, parsed.data);
    checkoutUrl = result.checkoutUrl;
  } catch (error) {
    return { success: false, ...mapKnownError(error) };
  }

  redirect(checkoutUrl);
}
