import { expect, test } from "@playwright/test";

/**
 * Smoke test E2E: as páginas públicas de autenticação renderizam e têm os
 * campos esperados. Não depende de um Supabase real (não submete formulário).
 *
 * Testes E2E dos fluxos críticos completos (login → dashboard, criação de
 * organização, isolamento cross-tenant via UI) dependem de um Supabase de
 * teste configurado e serão expandidos nas próximas fases — ver
 * docs/DECISIONS.md.
 */
test.describe("Páginas de autenticação", () => {
  test("/login renderiza o formulário", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("/register renderiza o formulário", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel("Nome completo")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirmar senha")).toBeVisible();
  });

  test("/recovery renderiza o formulário", async ({ page }) => {
    await page.goto("/recovery");
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });

  test("rota protegida redireciona para /login quando não autenticado", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  for (const path of [
    "/prospecting",
    "/companies",
    "/companies/new",
    "/companies/import",
    "/leads",
    "/pipeline",
    "/settings",
    // Fase 4: rota dinâmica de leads precisa de um UUID válido para o
    // Next.js tentar renderizar a página antes de checar a sessão — um
    // UUID qualquer (sintaticamente válido, mas inexistente) é suficiente
    // para exercitar o redirect de autenticação.
    "/leads/00000000-0000-4000-8000-000000000000",
    // Fase 5: idem para o Copilot — rota dinâmica de conversa.
    "/assistant",
    "/assistant/00000000-0000-4000-8000-000000000000",
    // Fase 6: billing.
    "/billing",
    "/billing/return",
  ]) {
    test(`${path} também redireciona para /login quando não autenticado`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
