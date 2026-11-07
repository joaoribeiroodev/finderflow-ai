import { describe, expect, it } from "vitest";

import { extractContactFields } from "./extract-contacts";

const SOURCE = "https://example.com.br";

describe("extractContactFields", () => {
  it("extrai e-mail de link mailto", () => {
    const html = `<a href="mailto:contato@example.com.br">Fale com a gente</a>`;
    const fields = extractContactFields(html, SOURCE);
    expect(fields).toContainEqual({
      fieldKey: "email",
      fieldValue: "contato@example.com.br",
      source: `website_scan:mailto:${SOURCE}`,
      confidence: 0.95,
    });
  });

  it("ignora mailto inválido", () => {
    const html = `<a href="mailto:nao-e-email">x</a>`;
    expect(extractContactFields(html, SOURCE)).toHaveLength(0);
  });

  it("extrai telefone de link tel e descarta números curtos", () => {
    const html = `<a href="tel:+5511987654321">Ligue</a><a href="tel:123">curto</a>`;
    const fields = extractContactFields(html, SOURCE);
    expect(fields).toContainEqual({
      fieldKey: "phone",
      fieldValue: "+5511987654321",
      source: `website_scan:tel:${SOURCE}`,
      confidence: 0.9,
    });
    expect(fields.filter((f) => f.fieldKey === "phone")).toHaveLength(1);
  });

  it("extrai links de redes sociais conhecidas", () => {
    const html = `
      <a href="https://www.instagram.com/minhaempresa">Instagram</a>
      <a href="https://facebook.com/minhaempresa">Facebook</a>
      <a href="https://linkedin.com/company/minhaempresa">LinkedIn</a>
    `;
    const fields = extractContactFields(html, SOURCE);
    expect(fields).toContainEqual(
      expect.objectContaining({ fieldKey: "social_instagram", fieldValue: "https://www.instagram.com/minhaempresa" }),
    );
    expect(fields).toContainEqual(
      expect.objectContaining({ fieldKey: "social_facebook", fieldValue: "https://facebook.com/minhaempresa" }),
    );
    expect(fields).toContainEqual(
      expect.objectContaining({ fieldKey: "social_linkedin", fieldValue: "https://linkedin.com/company/minhaempresa" }),
    );
  });

  it("descarta links genéricos de compartilhar/login em vez do perfil real", () => {
    const html = `
      <a href="https://www.facebook.com/sharer/sharer.php?u=https://example.com">Compartilhar</a>
      <a href="https://www.linkedin.com/login">Entrar</a>
    `;
    expect(extractContactFields(html, SOURCE)).toHaveLength(0);
  });

  it("deduplica o mesmo valor encontrado mais de uma vez", () => {
    const html = `
      <a href="mailto:contato@example.com.br">1</a>
      <a href="mailto:CONTATO@example.com.br">2</a>
    `;
    expect(extractContactFields(html, SOURCE)).toHaveLength(1);
  });

  it("retorna lista vazia para HTML sem nenhum sinal de contato", () => {
    const html = `<html><body><h1>Bem-vindo</h1></body></html>`;
    expect(extractContactFields(html, SOURCE)).toHaveLength(0);
  });
});
