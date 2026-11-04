import { describe, expect, it } from "vitest";

import { dealCloseSchema } from "./deals";

describe("dealCloseSchema", () => {
  it("aceita status won sem motivo", () => {
    const parsed = dealCloseSchema.safeParse({ status: "won" });
    expect(parsed.success).toBe(true);
  });

  it("exige motivo quando status é lost", () => {
    const parsed = dealCloseSchema.safeParse({ status: "lost" });
    expect(parsed.success).toBe(false);
  });

  it("aceita status lost com motivo informado", () => {
    const parsed = dealCloseSchema.safeParse({ status: "lost", lostReason: "Preço" });
    expect(parsed.success).toBe(true);
  });

  it("rejeita status inválido", () => {
    const parsed = dealCloseSchema.safeParse({ status: "open" });
    expect(parsed.success).toBe(false);
  });
});
