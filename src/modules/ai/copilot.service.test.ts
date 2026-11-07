import { describe, expect, it } from "vitest";

import { deriveConversationTitle } from "./copilot.service";

describe("deriveConversationTitle", () => {
  it("usa a mensagem inteira quando já é curta", () => {
    expect(deriveConversationTitle("Quantos leads tenho?")).toBe("Quantos leads tenho?");
  });

  it("normaliza espaços e quebras de linha", () => {
    expect(deriveConversationTitle("Oi,\n\n  quantas  tarefas   estão pendentes?")).toBe(
      "Oi, quantas tarefas estão pendentes?",
    );
  });

  it("corta em uma quebra de palavra e adiciona elipse quando a mensagem é longa", () => {
    const long =
      "Preciso que você me diga quantos leads estão na etapa de qualificação e quais têm tarefa vencida esta semana";
    const title = deriveConversationTitle(long);
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toContain("  ");
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
  });

  it("corta no espaço mais próximo do limite, não no meio de uma palavra, quando esse espaço não é cedo demais", () => {
    // "palavraUm palavraDois ..." — o espaço após "palavraDois" (índice 21)
    // está depois do limiar de 20, então deve cortar ali, não em "repetida".
    const title = deriveConversationTitle("palavraUm palavraDois " + "repetida".repeat(10));
    expect(title).toBe("palavraUm palavraDois…");
  });
});
