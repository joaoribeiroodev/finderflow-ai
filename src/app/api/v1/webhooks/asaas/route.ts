import { NextResponse } from "next/server";

import { getAsaasProvider } from "@/lib/billing/asaas-provider";
import { getServerEnv, isAsaasConfigured } from "@/lib/env/env.server";
import { logger } from "@/lib/logger/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { processAsaasWebhookEvent, verifyAsaasWebhookToken } from "@/modules/billing/webhook.service";

/**
 * Webhook do Asaas (docs/05-integrations.md §5.2 "Webhook"):
 * - Endpoint isolado, sem sessão de usuário.
 * - Autenticado pelo header `asaas-access-token` (nunca logado).
 * - Resposta rápida depois de persistir (a reivindicação atômica do
 *   evento ocorre antes de qualquer lógica de negócio — ver
 *   `processAsaasWebhookEvent`/`claim_asaas_webhook_event`).
 * - Entrega "at least once": duplicados não duplicam efeito.
 *
 * Nunca cacheado — depende de corpo/headers da requisição a cada chamada.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const env = getServerEnv();

  if (!isAsaasConfigured(env)) {
    // Sem webhook configurado, não há segredo para validar — recusamos
    // honestamente em vez de processar sem autenticação.
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  const tokenHeader = request.headers.get("asaas-access-token");
  if (!verifyAsaasWebhookToken(tokenHeader, env.ASAAS_WEBHOOK_TOKEN!)) {
    logger.warn("Webhook do Asaas recebido com token inválido ou ausente", { requestId });
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const provider = getAsaasProvider();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload bruto do provedor externo, validado campo a campo dentro do service
  const outcome = await processAsaasWebhookEvent(admin, provider, payload as any);

  // Nunca logar o payload bruto do webhook (pode conter dado financeiro
  // do assinante) — só o identificador do evento e o resultado do
  // processamento, que é exatamente o que docs/08-security-operations.md
  // §8.5 pede para observabilidade ("evento de webhook e status de
  // processamento").
  const eventId =
    typeof payload === "object" && payload !== null && "id" in payload
      ? String((payload as { id?: unknown }).id)
      : null;
  logger.info("Webhook do Asaas processado", {
    requestId,
    endpoint: "/api/v1/webhooks/asaas",
    eventId,
    durationMs: Date.now() - startedAt,
    status: outcome.reason,
    httpStatus: outcome.httpStatus,
  });

  return NextResponse.json({ status: outcome.reason }, { status: outcome.httpStatus });
}
