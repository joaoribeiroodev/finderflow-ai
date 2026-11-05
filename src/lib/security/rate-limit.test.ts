import { describe, expect, it } from "vitest";

import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("permite até o limite e bloqueia a partir daí dentro da mesma janela", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit(key, 3, 60_000);
      expect(r.allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("chaves diferentes têm contadores independentes", () => {
    const a = `test-a-${Math.random()}`;
    const b = `test-b-${Math.random()}`;
    checkRateLimit(a, 1, 60_000);
    const blockedA = checkRateLimit(a, 1, 60_000);
    const allowedB = checkRateLimit(b, 1, 60_000);
    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });

  it("libera novamente após a janela expirar", () => {
    const key = `test-expiry-${Math.random()}`;
    const first = checkRateLimit(key, 1, 10);
    expect(first.allowed).toBe(true);
    const immediatelyBlocked = checkRateLimit(key, 1, 10);
    expect(immediatelyBlocked.allowed).toBe(false);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const afterWindow = checkRateLimit(key, 1, 10);
        expect(afterWindow.allowed).toBe(true);
        resolve();
      }, 20);
    });
  });
});
