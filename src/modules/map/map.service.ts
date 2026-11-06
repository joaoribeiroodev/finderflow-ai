import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import { geocodeAddress, type GeocodableAddress } from "@/lib/geo/nominatim-geocoder";
import type { Database, Json } from "@/types/database";
import { MAP_NEUTRAL_COLOR, type MapCompanyPoint, type StageLegendEntry } from "./map.types";

export { MAP_NEUTRAL_COLOR, type MapCompanyPoint, type StageLegendEntry };

type Supabase = SupabaseClient<Database>;

function parseAddress(address: Json): { city: string | null; state: string | null } {
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    return { city: null, state: null };
  }
  const record = address as Record<string, unknown>;
  const city = typeof record.city === "string" && record.city.trim() ? record.city : null;
  const state = typeof record.state === "string" && record.state.trim() ? record.state : null;
  return { city, state };
}

/**
 * Empresas já geocodificadas (lat/lng preenchidos), coloridas pela etapa
 * atual do pipeline — "Etapa do funil", a opção escolhida com o usuário
 * para a aba Mapa. Empresas sem lead ativo usam `MAP_NEUTRAL_COLOR`.
 *
 * Duas queries + merge em memória (não um único select com embed), pelo
 * mesmo motivo do padrão já usado em `settings/page.tsx`: aqui o embed
 * via FK funcionaria, mas filtrar "lead ativo" (archived_at is null)
 * dentro de um embed aninhado do PostgREST junto com o join de
 * `pipeline_stages` complicaria a query sem ganho real — leads ativos por
 * organização é uma lista pequena.
 */
export async function listMapCompanies(
  supabase: Supabase,
  organizationId: string,
): Promise<{ points: MapCompanyPoint[]; stages: StageLegendEntry[] }> {
  const [companiesResult, stagesResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, category, address, latitude, longitude")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .not("latitude", "is", null)
      .not("longitude", "is", null),
    supabase
      .from("pipeline_stages")
      .select("id, name, color")
      .eq("organization_id", organizationId)
      .order("position", { ascending: true }),
  ]);

  if (companiesResult.error) {
    logger.error("Falha ao listar empresas geocodificadas para o mapa", {
      error: companiesResult.error.message,
      organizationId,
    });
    throw new Error("Não foi possível carregar as empresas do mapa.");
  }
  if (stagesResult.error) {
    logger.error("Falha ao listar etapas do pipeline para o mapa", {
      error: stagesResult.error.message,
      organizationId,
    });
    throw new Error("Não foi possível carregar as etapas do pipeline.");
  }

  const companies = companiesResult.data ?? [];
  const stages = stagesResult.data ?? [];
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));

  let leadsByCompanyId = new Map<string, { id: string; stage_id: string }>();
  if (companies.length > 0) {
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id, company_id, stage_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in(
        "company_id",
        companies.map((company) => company.id),
      );

    if (leadsError) {
      logger.error("Falha ao listar leads ativos para o mapa", {
        error: leadsError.message,
        organizationId,
      });
    } else {
      leadsByCompanyId = new Map((leads ?? []).map((lead) => [lead.company_id, lead]));
    }
  }

  const points: MapCompanyPoint[] = companies
    .filter((company) => company.latitude !== null && company.longitude !== null)
    .map((company) => {
      const { city, state } = parseAddress(company.address);
      const lead = leadsByCompanyId.get(company.id) ?? null;
      const stage = lead ? stageById.get(lead.stage_id) ?? null : null;
      return {
        id: company.id,
        name: company.name,
        category: company.category,
        city,
        state,
        latitude: company.latitude as number,
        longitude: company.longitude as number,
        stageId: stage?.id ?? null,
        stageName: stage?.name ?? null,
        stageColor: stage?.color ?? MAP_NEUTRAL_COLOR,
        leadId: lead?.id ?? null,
      };
    });

  return {
    points,
    stages: stages.map((stage) => ({ id: stage.id, name: stage.name, color: stage.color })),
  };
}

/** Quantas empresas ainda não têm coordenada e nunca falharam geocodificação — para a UI mostrar "faltam N". */
export async function countPendingGeocodes(supabase: Supabase, organizationId: string): Promise<number> {
  const { count, error } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .is("latitude", null)
    .is("geocode_failed_at", null);

  if (error) {
    logger.error("Falha ao contar empresas pendentes de geocodificação", {
      error: error.message,
      organizationId,
    });
    return 0;
  }
  return count ?? 0;
}

export interface GeocodeBatchResult {
  geocoded: MapCompanyPoint[];
  failed: number;
  remaining: number;
}

/**
 * Processa um pequeno lote de empresas sem coordenada: geocodifica uma a
 * uma (respeitando 1 req/s dentro de `geocodeAddress`) e grava o
 * resultado. Chamado pelo cliente do mapa logo após abrir a aba (ver
 * `src/components/map/companies-map.tsx`) — assim a página carrega
 * instantaneamente com o que já está geocodificado, e o resto "aparece"
 * aos poucos, sem travar o carregamento inicial nem violar o limite de
 * requisições do Nominatim com um lote gigante de uma vez.
 */
export async function geocodeNextBatch(
  supabase: Supabase,
  organizationId: string,
  batchSize: number,
): Promise<GeocodeBatchResult> {
  const { data: pending, error } = await supabase
    .from("companies")
    .select("id, name, category, address")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .is("latitude", null)
    .is("geocode_failed_at", null)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    logger.error("Falha ao buscar lote de empresas para geocodificar", {
      error: error.message,
      organizationId,
    });
    return { geocoded: [], failed: 0, remaining: 0 };
  }

  const geocodedCompanyIds: string[] = [];
  let failed = 0;

  for (const company of pending ?? []) {
    const { city, state } = parseAddress(company.address);
    const address: GeocodableAddress = {
      city,
      state,
      street:
        typeof company.address === "object" &&
        company.address &&
        !Array.isArray(company.address) &&
        typeof (company.address as Record<string, unknown>).street === "string"
          ? ((company.address as Record<string, unknown>).street as string)
          : null,
    };

    try {
      const result = await geocodeAddress(address);
      if (!result) {
        await supabase
          .from("companies")
          .update({ geocode_failed_at: new Date().toISOString() })
          .eq("id", company.id)
          .eq("organization_id", organizationId);
        failed += 1;
        continue;
      }

      await supabase
        .from("companies")
        .update({
          latitude: result.latitude,
          longitude: result.longitude,
          geocoded_at: new Date().toISOString(),
        })
        .eq("id", company.id)
        .eq("organization_id", organizationId);
      geocodedCompanyIds.push(company.id);
    } catch {
      // Falha de rede/timeout/5xx do Nominatim: não marca `geocode_failed_at`
      // (não é "endereço não encontrado"), simplesmente tenta de novo no
      // próximo lote/carregamento da página.
    }
  }

  const remaining = await countPendingGeocodes(supabase, organizationId);

  if (geocodedCompanyIds.length === 0) {
    return { geocoded: [], failed, remaining };
  }

  const { points } = await listMapCompanies(supabase, organizationId);
  const geocoded = points.filter((point) => geocodedCompanyIds.includes(point.id));

  return { geocoded, failed, remaining };
}
