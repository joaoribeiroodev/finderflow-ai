import "server-only";

import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export class SearchNotFoundError extends Error {
  constructor() {
    super("Busca não encontrada.");
    this.name = "SearchNotFoundError";
  }
}

interface ExportRow {
  nome: string;
  categoria: string;
  endereco: string;
  telefone: string;
  email: string;
  cnpj: string;
  site: string;
  temSiteIdentificado: string;
  jaCadastrada: string;
  fonte: string;
  dataColeta: string;
}

/** Função pura (sem I/O) — testável sem mockar o Supabase. */
export function buildRow(resultRow: {
  display_data: unknown;
  attribution: unknown;
  external_id: string | null;
  company_id: string | null;
  fetched_at: string;
}): ExportRow {
  const displayData = (resultRow.display_data ?? {}) as Record<string, unknown>;
  const attribution = (resultRow.attribution ?? {}) as Record<string, unknown>;
  const raw = (displayData.raw ?? {}) as Record<string, unknown>;
  const webPresence = displayData.webPresence as { hasWebsite?: unknown; websiteUrl?: unknown } | undefined;

  const municipio = typeof raw.municipio === "string" ? raw.municipio : undefined;
  const uf = typeof raw.uf === "string" ? raw.uf : undefined;
  const enderecoBase = typeof displayData.address === "string" ? displayData.address : "";
  const endereco = enderecoBase || [municipio, uf].filter(Boolean).join(" - ");

  let temSite = "Não verificado";
  if (webPresence && typeof webPresence.hasWebsite === "boolean") {
    temSite = webPresence.hasWebsite ? "Sim" : "Não identificado";
  }

  return {
    nome: typeof displayData.name === "string" ? displayData.name : "(sem nome)",
    categoria: typeof displayData.category === "string" ? displayData.category : "",
    endereco,
    telefone: typeof displayData.phone === "string" ? displayData.phone : "",
    email: typeof raw.email === "string" ? raw.email : "",
    cnpj: resultRow.external_id ?? "",
    site:
      typeof displayData.website === "string"
        ? displayData.website
        : typeof webPresence?.websiteUrl === "string"
          ? webPresence.websiteUrl
          : "",
    temSiteIdentificado: temSite,
    jaCadastrada: resultRow.company_id ? "Sim" : "Não",
    fonte: typeof attribution.via === "string" ? attribution.via : typeof attribution.source === "string" ? attribution.source : "",
    dataColeta: new Date(resultRow.fetched_at).toLocaleString("pt-BR"),
  };
}

const COLUMNS: { header: string; key: keyof ExportRow; width: number }[] = [
  { header: "Nome", key: "nome", width: 32 },
  { header: "Categoria", key: "categoria", width: 28 },
  { header: "Endereço", key: "endereco", width: 36 },
  { header: "Telefone", key: "telefone", width: 16 },
  { header: "E-mail", key: "email", width: 24 },
  { header: "CNPJ", key: "cnpj", width: 18 },
  { header: "Site", key: "site", width: 28 },
  { header: "Tem site identificado", key: "temSiteIdentificado", width: 18 },
  { header: "Já cadastrada como empresa", key: "jaCadastrada", width: 20 },
  { header: "Fonte dos dados", key: "fonte", width: 24 },
  { header: "Coletado em", key: "dataColeta", width: 20 },
];

/**
 * Gera um .xlsx com os resultados de uma busca já salva — nunca
 * consulta o provedor externo de novo, só lê `search_results` (mesma
 * fonte usada para reabrir uma busca do histórico). Pedido explícito
 * do usuário: "exportar as empresas encontradas em xlsx".
 */
export async function exportSearchResultsToXlsx(
  supabase: Supabase,
  organizationId: string,
  searchId: string,
): Promise<{ buffer: ArrayBuffer; filenameHint: string }> {
  const { data: search, error: searchError } = await supabase
    .from("searches")
    .select("id, query, created_at")
    .eq("organization_id", organizationId)
    .eq("id", searchId)
    .maybeSingle();

  if (searchError) {
    logger.error("Falha ao buscar registro de busca para exportação", {
      error: searchError.message,
      organizationId,
      searchId,
    });
    throw new Error("Não foi possível carregar esta busca.");
  }
  if (!search) throw new SearchNotFoundError();

  const { data: resultRows, error: resultsError } = await supabase
    .from("search_results")
    .select("display_data, attribution, external_id, company_id, fetched_at")
    .eq("organization_id", organizationId)
    .eq("search_id", searchId)
    .order("fetched_at", { ascending: true });

  if (resultsError) {
    logger.error("Falha ao carregar resultados para exportação", {
      error: resultsError.message,
      organizationId,
      searchId,
    });
    throw new Error("Não foi possível carregar os resultados desta busca.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FinderFlow AI";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Empresas encontradas");
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };

  for (const resultRow of resultRows ?? []) {
    sheet.addRow(buildRow(resultRow));
  }

  const buffer = await workbook.xlsx.writeBuffer();

  const safeQuery = search.query
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .toLowerCase();
  const dateStamp = new Date(search.created_at).toISOString().slice(0, 10);

  return {
    buffer,
    filenameHint: `finderflow-${safeQuery || "busca"}-${dateStamp}.xlsx`,
  };
}
