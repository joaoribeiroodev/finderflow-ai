import { describe, expect, it } from "vitest";

import { serviceSchema } from "./services";

describe("serviceSchema", () => {
  it("aceita um serviço de preço fixo com base price", () => {
    const parsed = serviceSchema.safeParse({
      name: "Consultoria de SEO",
      pricingType: "fixed",
      basePrice: "1500",
      isActive: "on",
    });
    expect(parsed.success).toBe(true);
  });

  it("exige preço base para fixed/hourly/recurring", () => {
    const parsed = serviceSchema.safeParse({
      name: "Consultoria de SEO",
      pricingType: "fixed",
      isActive: "on",
    });
    expect(parsed.success).toBe(false);
  });

  it("permite ausência de preço base quando pricingType é custom", () => {
    const parsed = serviceSchema.safeParse({
      name: "Projeto sob medida",
      pricingType: "custom",
      isActive: "on",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita nome muito curto", () => {
    const parsed = serviceSchema.safeParse({
      name: "A",
      pricingType: "custom",
      isActive: "on",
    });
    expect(parsed.success).toBe(false);
  });

  it("trata ausência do checkbox isActive como false", () => {
    const parsed = serviceSchema.safeParse({
      name: "Serviço qualquer",
      pricingType: "custom",
      isActive: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.isActive).toBe(false);
  });
});
