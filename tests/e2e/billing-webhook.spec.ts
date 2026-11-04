import { expect, test } from "@playwright/test";

/**
 * Smoke test E2E do endpoint de webhook do Asaas (Fase 6). Não depende
 * de credenciais reais do Asaas — verifica apenas o comportamento
 * honesto de borda: sem `ASAAS_WEBHOOK_TOKEN` configurado neste
 * ambiente, o endpoint nunca processa nada sem poder validar a
 * autenticidade do remetente.
 */
test.describe("Webhook do Asaas", () => {
  test("responde 503 quando o billing não está configurado neste ambiente", async ({ request }) => {
    const response = await request.post("/api/v1/webhooks/asaas", {
      data: { id: "evt_test", event: "PAYMENT_RECEIVED" },
    });
    expect(response.status()).toBe(503);
  });

  test("job de reconciliação responde 503 sem CRON_SECRET configurado", async ({ request }) => {
    const response = await request.post("/api/v1/jobs/billing-sync");
    expect(response.status()).toBe(503);
  });
});
