import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { ServiceInput } from "@/lib/validation/services";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;
export type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

/** Lista todos os serviços da organização (ativos e inativos), mais recentes primeiro. */
export async function listServices(supabase: Supabase, organizationId: string): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("organization_id", organizationId)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    logger.error("Falha ao listar serviços", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar os serviços.");
  }

  return data ?? [];
}

/** Apenas serviços ativos — usado em seletores de itens de proposta e no Company Analyzer. */
export async function listActiveServices(supabase: Supabase, organizationId: string): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    logger.error("Falha ao listar serviços ativos", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar os serviços.");
  }

  return data ?? [];
}

export async function getServiceById(
  supabase: Supabase,
  organizationId: string,
  serviceId: string,
): Promise<ServiceRow | null> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", serviceId)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao carregar serviço", { error: error.message, organizationId, serviceId });
    throw new Error("Não foi possível carregar o serviço.");
  }

  return data;
}

export async function createService(
  supabase: Supabase,
  organizationId: string,
  input: ServiceInput,
): Promise<ServiceRow> {
  const { data, error } = await supabase
    .from("services")
    .insert({
      organization_id: organizationId,
      name: input.name,
      description: input.description ?? null,
      pricing_type: input.pricingType,
      base_price: input.basePrice ?? null,
      is_active: input.isActive,
    })
    .select("*")
    .single();

  if (error) {
    logger.error("Falha ao criar serviço", { error: error.message, organizationId });
    throw new Error("Não foi possível criar o serviço.");
  }

  return data;
}

export async function updateService(
  supabase: Supabase,
  organizationId: string,
  serviceId: string,
  input: ServiceInput,
): Promise<ServiceRow> {
  const { data, error } = await supabase
    .from("services")
    .update({
      name: input.name,
      description: input.description ?? null,
      pricing_type: input.pricingType,
      base_price: input.basePrice ?? null,
      is_active: input.isActive,
    })
    .eq("organization_id", organizationId)
    .eq("id", serviceId)
    .select("*")
    .single();

  if (error) {
    logger.error("Falha ao atualizar serviço", { error: error.message, organizationId, serviceId });
    throw new Error("Não foi possível atualizar o serviço.");
  }

  return data;
}

/**
 * Serviços são apenas desativados, nunca excluídos de fato — `proposal_items`
 * referencia `service_id` com `on delete restrict` (migration de
 * referência), então um serviço já usado em alguma proposta não pode ser
 * removido sem quebrar o histórico. Desativar é a operação segura e
 * reversível.
 */
export async function setServiceActive(
  supabase: Supabase,
  organizationId: string,
  serviceId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("services")
    .update({ is_active: isActive })
    .eq("organization_id", organizationId)
    .eq("id", serviceId);

  if (error) {
    logger.error("Falha ao ativar/desativar serviço", { error: error.message, organizationId, serviceId });
    throw new Error("Não foi possível atualizar o status do serviço.");
  }
}
