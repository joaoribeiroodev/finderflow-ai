"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { resolveOrgAsaasCredentials } from "@/modules/organizations/asaas-credentials";
import { isValidCnpj } from "@/lib/utils/normalize";
import { logger } from "@/lib/logger/logger";
import { logAudit } from "@/lib/audit/audit-log";
import {
  createAsaasCharge,
  findOrCreateAsaasCustomer,
  getAsaasChargeStatus,
  getAsaasPixQrCode,
  type AsaasBillingType,
} from "@/lib/contracts/asaas-charges-client";

export interface ContractActionResult {
  success: boolean;
  message?: string;
}

export async function createChargeAction(
  _prev: ContractActionResult,
  formData: FormData,
): Promise<ContractActionResult> {
  const companyId = String(formData.get("companyId") ?? "").trim();
  const billingType = String(formData.get("billingType") ?? "") as AsaasBillingType;
  const valueRaw = String(formData.get("value") ?? "").replace(",", ".");
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!companyId) return { success: false, message: "Selecione uma empresa." };
  if (!["BOLETO", "PIX", "CREDIT_CARD", "UNDEFINED"].includes(billingType)) {
    return { success: false, message: "Selecione uma forma de cobrança válida." };
  }
  const value = Number(valueRaw);
  if (!Number.isFinite(value) || value <= 0) {
    return { success: false, message: "Informe um valor válido." };
  }
  if (!dueDate) return { success: false, message: "Informe a data de vencimento." };

  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const credentials = await resolveOrgAsaasCredentials(org.organizationId);
  if (!credentials) {
    return {
      success: false,
      message:
        "Configure a chave de API da Asaas da sua organização em Configurações → Integrações antes de criar cobranças.",
    };
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, cnpj, email, phone")
    .eq("id", companyId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();

  if (companyError || !company) {
    return { success: false, message: "Empresa não encontrada." };
  }
  if (!company.cnpj || !isValidCnpj(company.cnpj)) {
    return {
      success: false,
      message:
        "Esta empresa não tem um CPF/CNPJ válido cadastrado — a Asaas exige isso para criar o cliente. Edite a empresa e informe o documento.",
    };
  }

  try {
    // Cache local primeiro — evita recriar o customer na Asaas a cada cobrança.
    const { data: cached } = await supabase
      .from("contract_asaas_customers")
      .select("asaas_customer_id")
      .eq("organization_id", org.organizationId)
      .eq("company_id", companyId)
      .maybeSingle();

    let asaasCustomerId = cached?.asaas_customer_id ?? null;

    if (!asaasCustomerId) {
      asaasCustomerId = await findOrCreateAsaasCustomer(credentials.baseUrl, credentials.apiKey, {
        name: company.name,
        cpfCnpj: company.cnpj.replace(/\D/g, ""),
        email: company.email,
        phone: company.phone,
        externalReference: company.id,
      });

      const { error: cacheError } = await supabase.from("contract_asaas_customers").upsert({
        organization_id: org.organizationId,
        company_id: companyId,
        asaas_customer_id: asaasCustomerId,
      });
      if (cacheError) {
        logger.error("Falha ao gravar cache de cliente Asaas", {
          error: cacheError.message,
          organizationId: org.organizationId,
          companyId,
        });
      }
    }

    const charge = await createAsaasCharge(credentials.baseUrl, credentials.apiKey, {
      customerId: asaasCustomerId,
      billingType,
      value,
      dueDate,
      description,
      externalReference: companyId,
    });

    let pixPayload: string | null = null;
    if (billingType === "PIX") {
      const pix = await getAsaasPixQrCode(credentials.baseUrl, credentials.apiKey, charge.id);
      pixPayload = pix.payload;
    }

    const { error: insertError } = await supabase.from("contract_charges").insert({
      organization_id: org.organizationId,
      company_id: companyId,
      asaas_customer_id: asaasCustomerId,
      asaas_charge_id: charge.id,
      billing_type: billingType,
      status: charge.status,
      value,
      description,
      due_date: dueDate,
      invoice_url: charge.invoiceUrl,
      bank_slip_url: charge.bankSlipUrl,
      pix_payload: pixPayload,
      created_by: user?.id ?? null,
    });

    if (insertError) {
      logger.error("Falha ao persistir cobrança criada na Asaas", {
        error: insertError.message,
        organizationId: org.organizationId,
        asaasChargeId: charge.id,
      });
      return {
        success: false,
        message:
          "A cobrança foi criada na Asaas, mas não foi possível salvar o registro local. Confira diretamente no painel da Asaas.",
      };
    }
  } catch (error) {
    logger.error("Falha ao criar cobrança", { error: (error as Error).message, organizationId: org.organizationId });
    return {
      success: false,
      message: (error as Error).message || "Não foi possível criar a cobrança na Asaas.",
    };
  }

  await logAudit({
    organizationId: org.organizationId,
    actorId: user?.id ?? null,
    action: "contract_charge.create",
    resourceType: "contract_charges",
    resourceId: companyId,
    metadata: { billingType, value },
  });

  revalidatePath("/contracts");
  return { success: true, message: "Cobrança criada com sucesso." };
}

export async function refreshChargeStatusAction(chargeId: string): Promise<void> {
  const org = await requireActiveOrganization();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("contract_charges")
    .select("id, asaas_charge_id")
    .eq("id", chargeId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();

  if (!row) return;

  const credentials = await resolveOrgAsaasCredentials(org.organizationId);
  if (!credentials) return;

  try {
    const status = await getAsaasChargeStatus(credentials.baseUrl, credentials.apiKey, row.asaas_charge_id);
    await supabase
      .from("contract_charges")
      .update({
        status: status.status,
        invoice_url: status.invoiceUrl,
        bank_slip_url: status.bankSlipUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chargeId);
  } catch (error) {
    logger.error("Falha ao atualizar status da cobrança", {
      error: (error as Error).message,
      chargeId,
    });
  }

  revalidatePath("/contracts");
}
