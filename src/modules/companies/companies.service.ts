import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import { normalizeCompanyName, normalizeDocument, normalizeDomain } from "@/lib/utils/normalize";
import type { CompanyCsvRowInput, CompanyManualInput } from "@/lib/validation/companies";
import type { Database, Json } from "@/types/database";

type Supabase = SupabaseClient<Database>;
export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

const PAGE_SIZE = 20;

export interface CompanyListFilters {
  search?: string;
  category?: string;
  page?: number;
}

export interface CompanyListResult {
  companies: CompanyRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Lista empresas da organização ativa, com busca livre e filtro de categoria. RLS garante o escopo. */
export async function listCompanies(
  supabase: Supabase,
  organizationId: string,
  filters: CompanyListFilters = {},
): Promise<CompanyListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("companies")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.search && filters.search.trim().length > 0) {
    const term = normalizeCompanyName(filters.search);
    const digits = normalizeDocument(filters.search);
    const orParts = [`normalized_name.ilike.%${term}%`];
    if (digits) orParts.push(`cnpj.eq.${digits}`);
    query = query.or(orParts.join(","));
  }

  if (filters.category && filters.category.trim().length > 0) {
    query = query.eq("category", filters.category.trim());
  }

  const { data, error, count } = await query;

  if (error) {
    logger.error("Falha ao listar empresas", { error: error.message, organizationId });
    throw new Error("Não foi possível carregar as empresas.");
  }

  return { companies: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getCompanyById(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<CompanyRow | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    logger.error("Falha ao buscar empresa", { error: error.message, organizationId, companyId });
    throw new Error("Não foi possível carregar a empresa.");
  }

  return data;
}

/** Lista as categorias distintas já usadas pela organização, para o filtro da listagem. */
export async function listCompanyCategories(
  supabase: Supabase,
  organizationId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("category")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .not("category", "is", null);

  if (error) return [];

  const categories = new Set((data ?? []).map((row) => row.category).filter(Boolean) as string[]);
  return Array.from(categories).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  reason: "cnpj" | "domain";
}

/**
 * Procura empresas já cadastradas que provavelmente são a mesma, usando
 * sinais combinados (nunca apenas o nome, conforme docs/03-database.md
 * §3.4). CNPJ idêntico é tratado como bloqueio (é um identificador legal
 * único); domínio do site idêntico é tratado como aviso — pode ser uma
 * franquia/filial diferente com o mesmo site institucional.
 */
async function findDuplicateCandidates(
  supabase: Supabase,
  organizationId: string,
  signals: { cnpj?: string | null; website?: string | null },
): Promise<{ exactCnpjMatch: DuplicateCandidate | null; domainMatches: DuplicateCandidate[] }> {
  const cnpjDigits = normalizeDocument(signals.cnpj ?? null);
  let exactCnpjMatch: DuplicateCandidate | null = null;

  if (cnpjDigits) {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("cnpj", cnpjDigits)
      .is("archived_at", null)
      .maybeSingle();
    if (data) exactCnpjMatch = { id: data.id, name: data.name, reason: "cnpj" };
  }

  const domain = normalizeDomain(signals.website ?? null);
  let domainMatches: DuplicateCandidate[] = [];

  if (!exactCnpjMatch && domain) {
    const { data } = await supabase
      .from("companies")
      .select("id, name, website")
      .eq("organization_id", organizationId)
      .ilike("website", `%${domain}%`)
      .is("archived_at", null)
      .limit(5);
    domainMatches = (data ?? [])
      .filter((row) => normalizeDomain(row.website) === domain)
      .map((row) => ({ id: row.id, name: row.name, reason: "domain" as const }));
  }

  return { exactCnpjMatch, domainMatches };
}

export class DuplicateCompanyError extends Error {
  candidates: DuplicateCandidate[];
  constructor(message: string, candidates: DuplicateCandidate[]) {
    super(message);
    this.name = "DuplicateCompanyError";
    this.candidates = candidates;
  }
}

interface CreateCompanyOptions {
  origin: "manual" | "csv" | "provider";
  /** Se `true`, ignora avisos de duplicata por domínio (usuário já confirmou). Nunca ignora CNPJ idêntico. */
  confirmDuplicate?: boolean;
}

/**
 * Cria uma empresa com deduplicação conservadora:
 * - CNPJ idêntico já cadastrado → bloqueia (é o mesmo CNPJ, sempre o mesmo CNPJ).
 * - Domínio do site idêntico → avisa via `DuplicateCompanyError`, mas permite
 *   seguir se `confirmDuplicate` for true (pode ser filial/franquia distinta).
 * - Nome parecido isoladamente NUNCA bloqueia nem precisa de confirmação.
 */
export async function createCompany(
  supabase: Supabase,
  organizationId: string,
  input: CompanyManualInput | CompanyCsvRowInput,
  options: CreateCompanyOptions,
): Promise<CompanyRow> {
  const website = "website" in input ? input.website : undefined;
  const { exactCnpjMatch, domainMatches } = await findDuplicateCandidates(supabase, organizationId, {
    cnpj: input.cnpj,
    website,
  });

  if (exactCnpjMatch) {
    throw new DuplicateCompanyError(
      `Já existe uma empresa com este CNPJ cadastrada: "${exactCnpjMatch.name}".`,
      [exactCnpjMatch],
    );
  }

  if (domainMatches.length > 0 && !options.confirmDuplicate) {
    throw new DuplicateCompanyError(
      `Já existe${domainMatches.length > 1 ? "m" : ""} empresa${domainMatches.length > 1 ? "s" : ""} com o mesmo site: "${domainMatches[0].name}".`,
      domainMatches,
    );
  }

  const address =
    "street" in input && (input.street || input.city || input.state || input.zipCode)
      ? {
          street: input.street ?? null,
          city: input.city ?? null,
          state: input.state?.toUpperCase() ?? null,
          zipCode: input.zipCode ?? null,
        }
      : "city" in input && (input.city || input.state)
        ? { city: input.city ?? null, state: input.state?.toUpperCase() ?? null }
        : {};

  const { data, error } = await supabase
    .from("companies")
    .insert({
      organization_id: organizationId,
      name: input.name,
      normalized_name: normalizeCompanyName(input.name),
      cnpj: normalizeDocument(input.cnpj ?? null),
      category: input.category ?? null,
      website: website ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address,
      origin: options.origin,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new DuplicateCompanyError("Já existe uma empresa igual cadastrada.", []);
    }
    logger.error("Falha ao criar empresa", { error: error.message, organizationId });
    throw new Error("Não foi possível cadastrar a empresa.");
  }

  return data;
}

export interface ProviderCompanyInput {
  name: string;
  cnpj?: string | null;
  category?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
}

/**
 * Converte um resultado de `search_results` (vindo de um
 * `BusinessDataProvider`, ver `providers/business-data-provider.ts`)
 * em uma empresa cadastrada, com a mesma deduplicação conservadora de
 * `createCompany`, e registra a origem/atribuição em
 * `company_source_refs` — nunca perdendo de onde o dado veio, exigido
 * por `docs/03-database.md` para dados de provedor externo.
 */
export async function createCompanyFromSearchResult(
  supabase: Supabase,
  organizationId: string,
  input: ProviderCompanyInput,
  source: { provider: string; externalId: string; attribution: Record<string, unknown>; fetchedAt: string },
): Promise<CompanyRow> {
  const company = await createCompany(
    supabase,
    organizationId,
    {
      name: input.name,
      cnpj: input.cnpj ?? undefined,
      category: input.category ?? undefined,
      website: input.website ?? undefined,
      phone: input.phone ?? undefined,
      email: input.email ?? undefined,
      city: input.city ?? undefined,
      state: input.state ?? undefined,
    },
    { origin: "provider", confirmDuplicate: false },
  );

  const { error } = await supabase.from("company_source_refs").insert({
    organization_id: organizationId,
    company_id: company.id,
    provider: source.provider,
    external_id: source.externalId,
    attribution: source.attribution as Json,
    fetched_at: source.fetchedAt,
  });

  if (error) {
    // A empresa já foi criada; falhar em registrar a atribuição não deve
    // desfazer o cadastro (o usuário já viu a empresa criada) — só logamos.
    logger.error("Falha ao registrar company_source_refs", {
      error: error.message,
      organizationId,
      companyId: company.id,
      provider: source.provider,
    });
  }

  return company;
}

export async function archiveCompany(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<void> {
  const { error } = await supabase
    .from("companies")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", companyId);

  if (error) {
    logger.error("Falha ao arquivar empresa", { error: error.message, organizationId, companyId });
    throw new Error("Não foi possível arquivar a empresa.");
  }
}

export class CompanyAlreadyConvertedError extends Error {
  constructor() {
    super("Esta empresa já tem um lead ativo no pipeline.");
    this.name = "CompanyAlreadyConvertedError";
  }
}

/**
 * Converte uma empresa em lead na primeira etapa (menor `position`, não
 * fechada) do pipeline da organização. A unicidade é garantida pelo
 * índice parcial `leads_one_active_company_idx (organization_id,
 * company_id) WHERE archived_at IS NULL` — a verificação de duplicidade
 * acontece atomicamente no próprio INSERT (constraint do banco), não por
 * um SELECT prévio sujeito a condição de corrida.
 */
export async function convertCompanyToLead(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<string> {
  const { data: stage, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_closed", false)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (stageError || !stage) {
    logger.error("Falha ao resolver etapa inicial do pipeline", {
      error: stageError?.message,
      organizationId,
    });
    throw new Error("Não foi possível encontrar uma etapa de pipeline para o novo lead.");
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({ organization_id: organizationId, company_id: companyId, stage_id: stage.id })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new CompanyAlreadyConvertedError();
    }
    logger.error("Falha ao converter empresa em lead", {
      error: error.message,
      organizationId,
      companyId,
    });
    throw new Error("Não foi possível converter a empresa em lead.");
  }

  return data.id;
}

/** Verifica se a empresa já tem um lead ativo (para a UI decidir o que mostrar, sem bloquear nada). */
export async function getActiveLeadIdForCompany(
  supabase: Supabase,
  organizationId: string,
  companyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("leads")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .is("archived_at", null)
    .maybeSingle();

  return data?.id ?? null;
}
