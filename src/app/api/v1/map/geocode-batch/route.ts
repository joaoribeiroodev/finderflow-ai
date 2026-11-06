import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger/logger";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { geocodeNextBatch } from "@/modules/map/map.service";

/**
 * Backfill incremental de geocodificação para a aba Mapa. O componente
 * cliente (`src/components/map/companies-map.tsx`) chama esta rota
 * repetidamente, lote por lote, enquanto houver empresas pendentes — a
 * página em si (`/map`) já carrega instantaneamente com o que estiver
 * geocodificado até então, sem esperar o Nominatim (1 req/s).
 *
 * `BATCH_SIZE` pequeno de propósito: cada empresa no lote custa ~1.1s
 * (limite do Nominatim) dentro da mesma invocação de função serverless.
 */
export const dynamic = "force-dynamic";

const BATCH_SIZE = 6;

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { organizationId } = await requireActiveOrganization();
    await assertCanEditOrganization(supabase, organizationId);

    const result = await geocodeNextBatch(supabase, organizationId, BATCH_SIZE);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: "forbidden", message: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message === "NO_ACTIVE_ORGANIZATION") {
      return NextResponse.json({ error: "no_active_organization" }, { status: 403 });
    }
    logger.error("Falha no lote de geocodificação do mapa", {
      error: error instanceof Error ? error.message : "erro desconhecido",
    });
    return NextResponse.json({ error: "geocode_batch_failed" }, { status: 500 });
  }
}
