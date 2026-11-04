import { describe, expect, it } from "vitest";

import { isGraceExpired, mapAsaasSubscriptionStatus } from "./status";

describe("mapAsaasSubscriptionStatus", () => {
  it("mapeia ACTIVE + RECEIVED/CONFIRMED para active", () => {
    expect(
      mapAsaasSubscriptionStatus({ asaasStatus: "ACTIVE", deleted: false, latestPaymentStatus: "RECEIVED" }),
    ).toBe("active");
    expect(
      mapAsaasSubscriptionStatus({ asaasStatus: "ACTIVE", deleted: false, latestPaymentStatus: "CONFIRMED" }),
    ).toBe("active");
  });

  it("mapeia ACTIVE sem pagamento ainda para incomplete", () => {
    expect(
      mapAsaasSubscriptionStatus({ asaasStatus: "ACTIVE", deleted: false, latestPaymentStatus: null }),
    ).toBe("incomplete");
  });

  it("mapeia ACTIVE + OVERDUE para past_due", () => {
    expect(
      mapAsaasSubscriptionStatus({ asaasStatus: "ACTIVE", deleted: false, latestPaymentStatus: "OVERDUE" }),
    ).toBe("past_due");
  });

  it("mapeia INACTIVE + OVERDUE para past_due (ainda em tolerância)", () => {
    expect(
      mapAsaasSubscriptionStatus({ asaasStatus: "INACTIVE", deleted: false, latestPaymentStatus: "OVERDUE" }),
    ).toBe("past_due");
  });

  it("mapeia INACTIVE sem overdue para suspended", () => {
    expect(
      mapAsaasSubscriptionStatus({ asaasStatus: "INACTIVE", deleted: false, latestPaymentStatus: "RECEIVED" }),
    ).toBe("suspended");
  });

  it("mapeia EXPIRED para expired independentemente do pagamento", () => {
    expect(
      mapAsaasSubscriptionStatus({ asaasStatus: "EXPIRED", deleted: false, latestPaymentStatus: "RECEIVED" }),
    ).toBe("expired");
  });

  it("deleted=true sempre vira canceled, mesmo se ACTIVE", () => {
    expect(
      mapAsaasSubscriptionStatus({ asaasStatus: "ACTIVE", deleted: true, latestPaymentStatus: "RECEIVED" }),
    ).toBe("canceled");
  });

  it("reembolso isolado não derruba a assinatura (mantém active)", () => {
    expect(
      mapAsaasSubscriptionStatus({ asaasStatus: "ACTIVE", deleted: false, latestPaymentStatus: "REFUNDED" }),
    ).toBe("active");
  });
});

describe("isGraceExpired", () => {
  it("não expirou dentro da janela de tolerância", () => {
    const pastDueSince = new Date("2026-11-01T00:00:00Z");
    const now = new Date("2026-11-03T00:00:00Z");
    expect(isGraceExpired(pastDueSince, now)).toBe(false);
  });

  it("expirou após a janela de tolerância", () => {
    const pastDueSince = new Date("2026-11-01T00:00:00Z");
    const now = new Date("2026-11-10T00:00:00Z");
    expect(isGraceExpired(pastDueSince, now)).toBe(true);
  });
});
