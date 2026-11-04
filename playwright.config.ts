import { defineConfig, devices } from "@playwright/test";

/**
 * Testes E2E dos fluxos críticos (auth, multi-tenancy, RLS via UI).
 * Requer `npm run dev` ou `webServer` abaixo, e um Supabase local/dev
 * configurado com as variáveis de ambiente de teste (ver .env.example).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
