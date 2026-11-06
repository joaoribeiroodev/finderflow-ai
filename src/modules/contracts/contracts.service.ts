import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export interface ContractChargeView {
  id: string;
  companyId: string | null;
  companyName: string | null;
  billingType: string;
  status: string;
  value: number;
  description: string | null;
  dueDate: string | null;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixPayload: string | null;
  createdAt: string;
}

const PAGE_SIZE = 20;

export async function listContractCharges(
  supabase: Supabase,
  organizationId: string,
  page = 1,
): Promise<{ items: ContractChargeView[]; total: number; page: number; pageSize: number }> {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("contract_charges")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    logger.error("Falha ao listar cobranças da organização", {
      error: error.message,
      organizationId,
    });
    throw new Error("Não foi possível carregar as cobranças.");
  }

  const companyIds = (data ?? [])
    .map((row) => row.company_id)
    .filter((id): id is string => Boolean(id));

  const namesByCompanyId = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds);
    for (const c of companies ?? []) namesByCompanyId.set(c.id, c.name);
  }

  const items: ContractChargeView[] = (data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_id ? namesByCompanyId.get(row.company_id) ?? null : null,
    billingType: row.billing_type,
    status: row.status,
    value: Number(row.value),
    description: row.description,
    dueDate: row.due_date,
    invoiceUrl: row.invoice_url,
    bankSlipUrl: row.bank_slip_url,
    pixPayload: row.pix_payload,
    createdAt: row.created_at,
  }));

  return { items, total: count ?? items.length, page, pageSize: PAGE_SIZE };
}

export interface CompanyOption {
  id: string;
  name: string;
  cnpj: string | null;
}

/** Empresas elegíveis para cobrança — precisam de CNPJ/CPF cadastrado (exigência da Asaas). */
export async function listCompaniesForBilling(
  supabase: Supabase,
  organizationId: string,
): Promise<CompanyOption[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, cnpj")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("name", { ascending: true })
    .limit(300);

  if (error) {
    logger.error("Falha ao listar empresas para cobrança", { error: error.message, organizationId });
    return [];
  }

  return data ?? [];
}
