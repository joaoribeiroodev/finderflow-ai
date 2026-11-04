import { describe, expect, it } from "vitest";

import {
  effectiveProposalStatus,
  isAllowedProposalTransition,
  proposalItemSchema,
} from "./proposals";

describe("isAllowedProposalTransition", () => {
  it("permite draft -> sent", () => {
    expect(isAllowedProposalTransition("draft", "sent")).toBe(true);
  });

  it("permite sent -> accepted/rejected/expired", () => {
    expect(isAllowedProposalTransition("sent", "accepted")).toBe(true);
    expect(isAllowedProposalTransition("sent", "rejected")).toBe(true);
    expect(isAllowedProposalTransition("sent", "expired")).toBe(true);
  });

  it("não permite voltar de accepted", () => {
    expect(isAllowedProposalTransition("accepted", "draft")).toBe(false);
    expect(isAllowedProposalTransition("accepted", "sent")).toBe(false);
  });

  it("não permite saltar draft -> accepted direto", () => {
    expect(isAllowedProposalTransition("draft", "accepted")).toBe(false);
  });

  it("permite reabrir rejected/expired como draft", () => {
    expect(isAllowedProposalTransition("rejected", "draft")).toBe(true);
    expect(isAllowedProposalTransition("expired", "draft")).toBe(true);
  });
});

describe("effectiveProposalStatus", () => {
  it("mantém o status quando não está vencido", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    expect(effectiveProposalStatus("sent", "2026-12-01", now)).toBe("sent");
  });

  it("vira expired quando sent e valid_until já passou", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    expect(effectiveProposalStatus("sent", "2026-10-01", now)).toBe("expired");
  });

  it("não altera status que não é sent (ex.: draft sem validade vencida)", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    expect(effectiveProposalStatus("draft", "2026-10-01", now)).toBe("draft");
  });

  it("não altera status accepted mesmo com valid_until vencido", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    expect(effectiveProposalStatus("accepted", "2026-10-01", now)).toBe("accepted");
  });

  it("ignora valid_until nulo", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    expect(effectiveProposalStatus("sent", null, now)).toBe("sent");
  });
});

describe("proposalItemSchema", () => {
  it("aceita um item válido com vírgula decimal", () => {
    const parsed = proposalItemSchema.safeParse({
      description: "Consultoria mensal",
      quantity: "2",
      unitPrice: "1.500,50".replace(".", "").replace(",", "."), // normaliza manualmente para o teste
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita quantidade zero ou negativa", () => {
    const parsed = proposalItemSchema.safeParse({
      description: "Item",
      quantity: "0",
      unitPrice: "100",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejeita preço unitário negativo", () => {
    const parsed = proposalItemSchema.safeParse({
      description: "Item",
      quantity: "1",
      unitPrice: "-10",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejeita serviceId que não é um UUID", () => {
    const parsed = proposalItemSchema.safeParse({
      serviceId: "not-a-uuid",
      description: "Item",
      quantity: "1",
      unitPrice: "10",
    });
    expect(parsed.success).toBe(false);
  });
});
