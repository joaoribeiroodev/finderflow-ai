import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type OrganizationPersonType = "company" | "individual";

export interface OrganizationProfile {
  personType: OrganizationPersonType;
  legalName: string | null;
  tradeName: string | null;
  document: string | null;
  senderName: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  website: string | null;
  addressCity: string | null;
  addressState: string | null;
  pitch: string | null;
  unsubscribeText: string | null;
}

export interface OrganizationProfileInput {
  personType: OrganizationPersonType;
  legalName?: string | null;
  tradeName?: string | null;
  document?: string | null;
  senderName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  website?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  pitch?: string | null;
  unsubscribeText?: string | null;
}

const EMPTY_PROFILE: OrganizationProfile = {
  personType: "company",
  legalName: null,
  tradeName: null,
  document: null,
  senderName: null,
  email: null,
  phone: null,
  whatsappNumber: null,
  website: null,
  addressCity: null,
  addressState: null,
  pitch: null,
  unsubscribeText: null,
};

/**
 * Perfil cadastral da organização (pessoa jurídica ou física) — usado
 * para personalizar a prospecção automatizada por e-mail: quem está
 * vendendo (sender_name), o que vende (pitch) e, sobretudo, o WhatsApp
 * para a IA sempre oferecer continuar a conversa por lá. Dado não
 * sensível — tabela simples com RLS por papel, sem Vault (diferente das
 * credenciais de API em `organization_integration_credentials`).
 */
export async function getOrganizationProfile(
  supabase: Supabase,
  organizationId: string,
): Promise<OrganizationProfile> {
  const { data, error } = await supabase
    .from("organization_profiles")
    .select(
      "person_type, legal_name, trade_name, document, sender_name, email, phone, whatsapp_number, website, address_city, address_state, pitch, unsubscribe_text",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao carregar perfil da organização", { error: error.message, organizationId });
    return EMPTY_PROFILE;
  }
  if (!data) return EMPTY_PROFILE;

  return {
    personType: (data.person_type as OrganizationPersonType) ?? "company",
    legalName: data.legal_name,
    tradeName: data.trade_name,
    document: data.document,
    senderName: data.sender_name,
    email: data.email,
    phone: data.phone,
    whatsappNumber: data.whatsapp_number,
    website: data.website,
    addressCity: data.address_city,
    addressState: data.address_state,
    pitch: data.pitch,
    unsubscribeText: data.unsubscribe_text,
  };
}

export async function upsertOrganizationProfile(
  supabase: Supabase,
  organizationId: string,
  input: OrganizationProfileInput,
): Promise<void> {
  const { error } = await supabase.from("organization_profiles").upsert({
    organization_id: organizationId,
    person_type: input.personType,
    legal_name: input.legalName ?? null,
    trade_name: input.tradeName ?? null,
    document: input.document ?? null,
    sender_name: input.senderName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    whatsapp_number: input.whatsappNumber ?? null,
    website: input.website ?? null,
    address_city: input.addressCity ?? null,
    address_state: input.addressState ?? null,
    pitch: input.pitch ?? null,
    unsubscribe_text: input.unsubscribeText ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    logger.error("Falha ao salvar perfil da organização", { error: error.message, organizationId });
    throw new Error("Não foi possível salvar o perfil da organização.");
  }
}

/**
 * Resumo em texto para injetar no prompt de geração de e-mail de
 * prospecção (ver `modules/ai/prompts.ts` `buildOutreachGeneratorInput`).
 * `null` quando o perfil está totalmente vazio — a IA então assina de
 * forma genérica, sem inventar nome/empresa/contato.
 */
export function formatOrganizationProfileForPrompt(profile: OrganizationProfile): string | null {
  const hasAnyData =
    profile.legalName ||
    profile.tradeName ||
    profile.senderName ||
    profile.whatsappNumber ||
    profile.website ||
    profile.pitch;
  if (!hasAnyData) return null;

  const name = profile.tradeName ?? profile.legalName;
  return [
    `Tipo: ${profile.personType === "individual" ? "pessoa física (profissional autônomo)" : "empresa"}`,
    name ? `Nome/razão social de quem está prospectando: ${name}` : null,
    profile.senderName ? `Nome de quem assina o e-mail (remetente humano): ${profile.senderName}` : null,
    profile.pitch ? `O que a organização vende/oferece (use isso para ancorar a oferta, nunca invente outro serviço): ${profile.pitch}` : null,
    profile.website ? `Site: ${profile.website}` : null,
    profile.whatsappNumber
      ? `WhatsApp para continuar a conversa: ${profile.whatsappNumber} (SEMPRE que o canal for e-mail, convide a pessoa a continuar por este WhatsApp)`
      : null,
    profile.addressCity || profile.addressState
      ? `Localização: ${[profile.addressCity, profile.addressState].filter(Boolean).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}
