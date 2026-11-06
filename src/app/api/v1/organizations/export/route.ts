import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger/logger";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { assertCanAdminOrganization, PermissionError } from "@/lib/permissions/permissions";
import { exportOrganizationData } from "@/modules/organizations/export.service";

/**
 * Exportação de dados (Configurações → Privacidade e segurança). Gera o
 * JSON sob demanda — nada fica cacheado — e exige admin/owner da
 * organização (mesmo princípio do `assertCanAdminOrganization` usado nas
 * Server Actions: revalida no banco, não confia só na RLS).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { organizationId, organizationSlug } = await requireActiveOrganization();
    await assertCanAdminOrganization(supabase, organizationId);

    const bundle = await exportOrganizationData(supabase, organizationId);
    const filename = `finderflow-dados-${organizationSlug}-${bundle.exportedAt.slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: "forbidden", message: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message === "NO_ACTIVE_ORGANIZATION") {
      return NextResponse.json({ error: "no_active_organization" }, { status: 403 });
    }
    logger.error("Falha ao exportar dados da organização", {
      error: error instanceof Error ? error.message : "erro desconhecido",
    });
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
