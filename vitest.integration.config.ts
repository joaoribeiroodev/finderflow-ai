import { defineConfig } from "vitest/config";

/**
 * Config separada dos testes de integração (RLS/cross-tenant), que
 * dependem de um Supabase local ou dev real — nunca rodam no `npm test`
 * padrão (unitário) nem em ambientes sem essa infraestrutura.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
  },
});
