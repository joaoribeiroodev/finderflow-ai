import { describe, expect, it } from "vitest";

import { extractRegistrableDomain, isNonOwnedDomain } from "./non-owned-domains";

describe("non-owned-domains", () => {
  it("reconhece domínios de redes sociais e diretórios como não-próprios", () => {
    expect(isNonOwnedDomain("https://www.instagram.com/alguma_empresa")).toBe(true);
    expect(isNonOwnedDomain("https://m.facebook.com/alguma-empresa")).toBe(true);
    expect(isNonOwnedDomain("https://www.guiamais.com.br/empresa/123")).toBe(true);
    expect(isNonOwnedDomain("https://cnpj.biz/12345678000190")).toBe(true);
  });

  it("trata um domínio comum (.com.br) de empresa real como próprio", () => {
    expect(isNonOwnedDomain("https://www.empresateste.com.br")).toBe(false);
    expect(isNonOwnedDomain("https://restaurantedoze.com")).toBe(false);
  });

  it("trata URL ilegível como não-confiável (não-próprio)", () => {
    expect(isNonOwnedDomain("não é uma url")).toBe(true);
  });

  it("extractRegistrableDomain lida com sufixos compostos (.com.br)", () => {
    expect(extractRegistrableDomain("www.empresateste.com.br")).toBe("empresateste.com.br");
    expect(extractRegistrableDomain("sub.empresateste.com.br")).toBe("empresateste.com.br");
    expect(extractRegistrableDomain("empresateste.com")).toBe("empresateste.com");
  });
});
