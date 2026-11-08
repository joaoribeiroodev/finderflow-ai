import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type CampaignCompanyStatus = "selected" | "excluded" | "contacted" | "responded";

export interface CampaignRow {
  id: string;
  name: string;
  objective: string | null;
  status: CampaignStatus;
  createdAt: string;
}

export interface CampaignListEntry extends CampaignRow {
  companyCount: number;
  contactedCount: number;
  respondedCount: number;
}

/**
 * Módulo 6 — Campanhas de Vendas. `campaigns`/`campaign_companies`
 * (migration `module6_campaigns`) — ver `docs/DECISIONS.md` para a
 * decisão sobre o texto de descadastro (não inferido, configurável por
 * organização em `organization_profiles.unsubscribe_text`).
 */
export async function createCampaign(
  supabase: Supabase,
  organizationId: string,
  input: { name: string; objective: string | null },
  createdBy: string | null,
): Promise<CampaignRow> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      organization_id: organizationId,
      name: input.name,
      objective: input.objective,
      created_by: createdBy,
    })
    .select("id, name, objective, status, created_at")
    .single();

  if (error || !data) {
    logger.error("Falha ao criar campanha", { error: error?.message, organizationId });
    throw new Error("Não foi possível criar a campanha.");
  }

  return {
    id: data.id,
    name: data.name,
    objective: data.objective,
    status: data.status as CampaignStatus,
    createdAt: data.created_at,
  };
}

export async function listCampaigns(supabase: Supabase, organizationId: string): Promise<CampaignListEntry[]> {
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, objective, status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar campanhas", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar as campanhas.");
  }
  if (!campaigns || campaigns.length === 0) return [];

  const { data: companies, error: companiesError } = await supabase
    .from("campaign_companies")
    .select("campaign_id, status")
    .eq("organization_id", organizationId);

  if (companiesError) {
    logger.error("Falha ao contar empresas das campanhas", { error: companiesError.message, organizationId });
    throw new Error("Não foi possível carregar as campanhas.");
  }

  const countsByCampaign = new Map<string, { total: number; contacted: number; responded: number }>();
  for (const row of companies ?? []) {
    const counts = countsByCampaign.get(row.campaign_id) ?? { total: 0, contacted: 0, responded: 0 };
    counts.total += 1;
    if (row.status === "contacted") counts.contacted += 1;
    if (row.status === "responded") counts.responded += 1;
    countsByCampaign.set(row.campaign_id, counts);
  }

  return campaigns.map((c) => {
    const counts = countsByCampaign.get(c.id) ?? { total: 0, contacted: 0, responded: 0 };
    return {
      id: c.id,
      name: c.name,
      objective: c.objective,
      status: c.status as CampaignStatus,
      createdAt: c.created_at,
      companyCount: counts.total,
      contactedCount: counts.contacted,
      respondedCount: counts.responded,
    };
  });
}

export async function getCampaignById(
  supabase: Supabase,
  organizationId: string,
  campaignId: string,
): Promise<CampaignRow | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, objective, status, created_at")
    .eq("organization_id", organizationId)
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao buscar campanha", { error: error.message, organizationId, campaignId });
    throw new Error("Não foi possível carregar a campanha.");
  }
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    objective: data.objective,
    status: data.status as CampaignStatus,
    createdAt: data.created_at,
  };
}

/**
 * Ativar/pausar/concluir uma campanha é só um rótulo de organização aqui
 * — quem bloqueia o envio de fato é `getCampaignMessageSendBlockReason`
 * por mensagem (status de aprovação + texto de descadastro + Gmail),
 * nunca o status da campanha isoladamente.
 */
export async function updateCampaignStatus(
  supabase: Supabase,
  organizationId: string,
  campaignId: string,
  status: CampaignStatus,
): Promise<void> {
  const { error } = await supabase
    .from("campaigns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", campaignId);

  if (error) {
    logger.error("Falha ao atualizar status da campanha", { error: error.message, organizationId, campaignId });
    throw new Error("Não foi possível atualizar o status da campanha.");
  }
}

export interface CampaignCompanyRow {
  id: string;
  companyId: string;
  companyName: string;
  status: CampaignCompanyStatus;
  addedAt: string;
  messageId: string | null;
  messageStatus: "draft" | "approved" | "sent" | "failed" | null;
}

export async function listCampaignCompanies(
  supabase: Supabase,
  organizationId: string,
  campaignId: string,
): Promise<CampaignCompanyRow[]> {
  const { data, error } = await supabase
    .from("campaign_companies")
    .select(
      "id, status, added_at, company:companies(id, name), message:campaign_messages(id, status)",
    )
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .order("added_at", { ascending: false });

  if (error) {
    logger.error("Falha ao listar empresas da campanha", { error: error.message, organizationId, campaignId });
    throw new Error("Não foi possível carregar as empresas desta campanha.");
  }

  return (data ?? []).map((row) => {
    const company = row.company as unknown as { id: string; name: string } | null;
    const message = row.message as unknown as { id: string; status: string } | null;
    return {
      id: row.id,
      companyId: company?.id ?? "",
      companyName: company?.name ?? "Empresa sem nome",
      status: row.status as CampaignCompanyStatus,
      addedAt: row.added_at,
      messageId: message?.id ?? null,
      messageStatus: (message?.status as CampaignCompanyRow["messageStatus"]) ?? null,
    };
  });
}

/** Adiciona empresas à campanha, ignorando silenciosamente as que já estavam (unique constraint). */
export async function addCompaniesToCampaign(
  supabase: Supabase,
  organizationId: string,
  campaignId: string,
  companyIds: string[],
  addedBy: string | null,
): Promise<number> {
  if (companyIds.length === 0) return 0;

  const { data, error } = await supabase
    .from("campaign_companies")
    .upsert(
      companyIds.map((companyId) => ({
        organization_id: organizationId,
        campaign_id: campaignId,
        company_id: companyId,
        added_by: addedBy,
      })),
      { onConflict: "campaign_id,company_id", ignoreDuplicates: true },
    )
    .select("id");

  if (error) {
    logger.error("Falha ao adicionar empresas à campanha", { error: error.message, organizationId, campaignId });
    throw new Error("Não foi possível adicionar as empresas à campanha.");
  }

  return data?.length ?? 0;
}

export async function updateCampaignCompanyStatus(
  supabase: Supabase,
  organizationId: string,
  campaignCompanyId: string,
  status: CampaignCompanyStatus,
): Promise<void> {
  const { error } = await supabase
    .from("campaign_companies")
    .update({ status })
    .eq("organization_id", organizationId)
    .eq("id", campaignCompanyId);

  if (error) {
    logger.error("Falha ao atualizar status da empresa na campanha", {
      error: error.message,
      organizationId,
      campaignCompanyId,
    });
    throw new Error("Não foi possível atualizar o status desta empresa na campanha.");
  }
}
