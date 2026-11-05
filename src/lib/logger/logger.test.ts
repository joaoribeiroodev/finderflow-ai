import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "./logger";

describe("logger (redaction)", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  function lastEntry(): Record<string, unknown> {
    const raw = logSpy.mock.calls.at(-1)?.[0] as string;
    return JSON.parse(raw);
  }

  it("redige campos sensíveis por nome, mesmo aninhados", () => {
    logger.info("evento de teste", {
      organizationId: "org-1",
      password: "super-secreta",
      accessToken: "abc123",
      cpf: "123.456.789-00",
      nested: { apiKey: "sk-live-xxx", safe: "ok" },
    });

    const entry = lastEntry();
    expect(entry.organizationId).toBe("org-1");
    expect(entry.password).toBe("[REDACTED]");
    expect(entry.accessToken).toBe("[REDACTED]");
    expect(entry.cpf).toBe("[REDACTED]");
    expect((entry.nested as Record<string, unknown>).apiKey).toBe("[REDACTED]");
    expect((entry.nested as Record<string, unknown>).safe).toBe("ok");
  });

  it("redige dentro de arrays de objetos", () => {
    logger.info("lote", {
      items: [{ token: "t1", id: 1 }, { token: "t2", id: 2 }],
    });
    const entry = lastEntry();
    const items = entry.items as Array<Record<string, unknown>>;
    expect(items[0]!.token).toBe("[REDACTED]");
    expect(items[0]!.id).toBe(1);
    expect(items[1]!.token).toBe("[REDACTED]");
  });

  it("preserva campos não sensíveis intactos", () => {
    logger.info("ok", { requestId: "r1", durationMs: 42, status: "completed" });
    const entry = lastEntry();
    expect(entry.requestId).toBe("r1");
    expect(entry.durationMs).toBe(42);
    expect(entry.status).toBe("completed");
  });
});
