import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger/logger";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { exportSearchResultsToXlsx, SearchNotFoundError } from "@/modules/prospecting/export.service";

/**
 * Exporta os resultados de uma busca já salva para .xlsx — nunca gera
 * uma nova busca ao provedor (lê só o que já está em `search_results`,
 * igual ao histórico). Protegido por sessão + RLS por organização, não
 * por um token separado: é uma ação do usuário logado, não um webhook.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ searchId: string }> }) {
  const { searchId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { organizationId } = await requireActiveOrganization();
    const { buffer, filenameHint } = await exportSearchResultsToXlsx(supabase, organizationId, searchId);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filenameHint}"`,
      },
    });
  } catch (error) {
    if (error instanceof SearchNotFoundError) {
      return NextResponse.json({ error: "search_not_found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "NO_ACTIVE_ORGANIZATION") {
      return NextResponse.json({ error: "no_active_organization" }, { status: 403 });
    }
    logger.error("Falha ao exportar resultados de busca para XLSX", {
      error: error instanceof Error ? error.message : "erro desconhecido",
      searchId,
    });
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
