import { NextResponse } from "next/server";

import { getAsaasProvider } from "@/lib/billing/asaas-provider";
import { getServerEnv } from "@/lib/env/env.server";
import { logger } from "@/lib/logger/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileSubscriptions } from "@/modules/billing/reconcile.service";

/**
 * Job de reconciliação periódica do billing (ver
 * `src/modules/billing/reconcile.service.ts` para o que exatamente é
 * corrigido e por quê o escopo é limitado).
 *
 * **Não há agendador configurado neste ambiente.** Este endpoint precisa
 * ser chamado periodicamente por um scheduler externo (Vercel Cron,
 * GitHub Actions, etc.) com `Authorization: Bearer ${CRON_SECRET}` —
 * documentado em README.md/DECISIONS.md como pendência explícita, não
 * escondida.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const env = getServerEnv();

  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    logger.warn("Job de reconciliação de billing: tentativa não autorizada", { requestId });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const provider = getAsaasProvider();

  try {
    const summary = await reconcileSubscriptions(admin, provider);
    logger.info("Job de reconciliação de billing concluído", {
      requestId,
      endpoint: "/api/v1/jobs/billing-sync",
      durationMs: Date.now() - startedAt,
      status: "completed",
      summary,
    });
    return NextResponse.json({ summary });
  } catch (error) {
    logger.error("Falha no job de reconciliação de billing", {
      requestId,
      endpoint: "/api/v1/jobs/billing-sync",
      durationMs: Date.now() - startedAt,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "reconcile_failed" }, { status: 500 });
  }
}
