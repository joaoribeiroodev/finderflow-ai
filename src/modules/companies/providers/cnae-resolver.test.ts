import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSegmentToCnae } from "./cnae-resolver";

const { runStructuredAIMock } = vi.hoisted(() => ({ runStructuredAIMock: vi.fn() }));

vi.mock("@/lib/ai/engine", () => ({
  runStructuredAI: runStructuredAIMock,
}));

const supabase = {} as never;

describe("resolveSegmentToCnae", () => {
  afterEach(() => {
    runStructuredAIMock.mockReset();
  });

  it("resolve por palavra-chave sem chamar a IA", async () => {
    const result = await resolveSegmentToCnae(supabase, "org-1", { segment: "restaurantes" });

    expect(result.method).toBe("keyword");
    expect(result.cnaeCodes).toEqual(["5611201", "5611203"]);
    expect(runStructuredAIMock).not.toHaveBeenCalled();
  });

  it("devolve 'none' sem segmento nem busca", async () => {
    const result = await resolveSegmentToCnae(supabase, "org-1", {});
    expect(result.method).toBe("none");
    expect(result.cnaeCodes).toEqual([]);
  });

  it("recorre à IA quando a palavra-chave não casa, e aceita uma chave válida do catálogo", async () => {
    runStructuredAIMock.mockResolvedValueOnce({
      status: "completed",
      data: { matchedKey: "clinicas_odontologicas" },
    });

    const result = await resolveSegmentToCnae(supabase, "org-1", { query: "quem cuida de dentes doloridos" });

    expect(runStructuredAIMock).toHaveBeenCalledTimes(1);
    expect(result.method).toBe("ai");
    expect(result.cnaeCodes).toEqual(["8630504"]);
  });

  it("ignora uma chave fora do catálogo devolvida pela IA (defesa em profundidade)", async () => {
    runStructuredAIMock.mockResolvedValueOnce({
      status: "completed",
      data: { matchedKey: "chave-inventada-que-nao-existe" },
    });

    const result = await resolveSegmentToCnae(supabase, "org-1", { query: "algo bem obscuro" });

    expect(result.method).toBe("none");
    expect(result.cnaeCodes).toEqual([]);
  });

  it("degrada para 'none' quando a IA não está configurada/falha", async () => {
    runStructuredAIMock.mockRejectedValueOnce(new Error("IA não configurada"));

    const result = await resolveSegmentToCnae(supabase, "org-1", { query: "algo bem obscuro" });

    expect(result.method).toBe("none");
    expect(result.cnaeCodes).toEqual([]);
  });

  it("devolve 'none' quando a IA responde sem match (matchedKey null)", async () => {
    runStructuredAIMock.mockResolvedValueOnce({ status: "completed", data: { matchedKey: null } });

    const result = await resolveSegmentToCnae(supabase, "org-1", { query: "algo bem obscuro" });

    expect(result.method).toBe("none");
  });
});
