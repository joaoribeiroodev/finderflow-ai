import { describe, expect, it } from "vitest";

import { formatOrganizationProfileForPrompt, type OrganizationProfile } from "./profile.service";

const EMPTY: OrganizationProfile = {
  personType: "company",
  legalName: null,
  tradeName: null,
  document: null,
  senderName: null,
  email: null,
  phone: null,
  whatsappNumber: null,
  website: null,
  addressCity: null,
  addressState: null,
  pitch: null,
  unsubscribeText: null,
};

describe("formatOrganizationProfileForPrompt", () => {
  it("retorna null quando o perfil está totalmente vazio (IA não deve inventar assinatura)", () => {
    expect(formatOrganizationProfileForPrompt(EMPTY)).toBeNull();
  });

  it("inclui o WhatsApp com instrução explícita de convidar para continuar lá", () => {
    const summary = formatOrganizationProfileForPrompt({
      ...EMPTY,
      tradeName: "Minha Agência",
      whatsappNumber: "(71) 90000-0000",
    });
    expect(summary).toContain("Minha Agência");
    expect(summary).toContain("(71) 90000-0000");
    expect(summary).toContain("convide a pessoa a continuar por este WhatsApp");
  });

  it("não inclui WhatsApp quando não informado", () => {
    const summary = formatOrganizationProfileForPrompt({ ...EMPTY, pitch: "Crio sites" });
    expect(summary).not.toContain("WhatsApp");
  });

  it("identifica pessoa física vs empresa", () => {
    const individual = formatOrganizationProfileForPrompt({
      ...EMPTY,
      personType: "individual",
      senderName: "João",
    });
    expect(individual).toContain("pessoa física");
  });
});
