import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchResultView } from "@/modules/prospecting/actions";

const actions = vi.hoisted(() => ({
  checkWebPresenceAction: vi.fn(),
  checkWebPresenceBatchAction: vi.fn(),
  convertSearchResultToCompanyAction: vi.fn(),
  convertSearchResultToLeadAction: vi.fn(),
  searchByCnpjAction: vi.fn(),
  searchCompaniesAction: vi.fn(),
}));

vi.mock("@/modules/prospecting/actions", () => actions);

import { SearchResultsList } from "./search-form";

function result(id: string, cachedWebPresence?: SearchResultView["cachedWebPresence"]): SearchResultView {
  return {
    searchResultId: id,
    name: `Empresa ${id}`,
    attributionLabel: "Dados: Receita Federal",
    alreadyConverted: false,
    cachedWebPresence,
  };
}

const RESULTS = [
  result("a", { hasWebsite: false }),
  result("b", { hasWebsite: true, websiteUrl: "https://b.example" }),
  result("c"),
  result("d"),
];

describe("SearchResultsList — triagem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("conta e filtra por presença digital", () => {
    render(<SearchResultsList results={RESULTS} />);

    expect(screen.getByRole("button", { name: /Todos \(4\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Não verificados \(2\)/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sem site \(1\)/ }));

    expect(screen.getByText("Empresa a")).toBeInTheDocument();
    expect(screen.queryByText("Empresa b")).not.toBeInTheDocument();
    expect(screen.queryByText("Empresa c")).not.toBeInTheDocument();
  });

  it("só oferece a verificação em lote quando liberada", () => {
    const { rerender } = render(<SearchResultsList results={RESULTS} />);
    expect(screen.queryByRole("button", { name: /Verificar site de todos/ })).not.toBeInTheDocument();

    rerender(<SearchResultsList results={RESULTS} bulkPresenceCheck />);
    expect(screen.getByRole("button", { name: /Verificar site de todos \(2\)/ })).toBeInTheDocument();
  });

  it("verifica em lote só os não verificados e atualiza as contagens", async () => {
    actions.checkWebPresenceBatchAction.mockResolvedValue({
      success: true,
      outcomes: [
        { searchResultId: "c", success: true, hasWebsite: false },
        { searchResultId: "d", success: true, hasWebsite: true, websiteUrl: "https://d.example" },
      ],
    });

    render(<SearchResultsList results={RESULTS} bulkPresenceCheck />);
    fireEvent.click(screen.getByRole("button", { name: /Verificar site de todos/ }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Sem site \(2\)/ })).toBeInTheDocument());
    expect(actions.checkWebPresenceBatchAction).toHaveBeenCalledTimes(1);
    expect(actions.checkWebPresenceBatchAction).toHaveBeenCalledWith(["c", "d"]);
    expect(screen.getByRole("button", { name: /Com site \(2\)/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Verificar site de todos/ })).not.toBeInTheDocument();
  });

  it("devolve as linhas para 'não verificado' e mostra o erro se o lote falhar", async () => {
    actions.checkWebPresenceBatchAction.mockResolvedValue({ success: false, message: "Lote recusado." });

    render(<SearchResultsList results={RESULTS} bulkPresenceCheck />);
    fireEvent.click(screen.getByRole("button", { name: /Verificar site de todos/ }));

    expect(await screen.findByText("Lote recusado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Não verificados \(2\)/ })).toBeInTheDocument();
  });

  it("cria o lead em um clique e mostra o link", async () => {
    actions.convertSearchResultToLeadAction.mockResolvedValue({ success: true, companyId: "co", leadId: "lead-1" });

    render(<SearchResultsList results={[result("a")]} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar como lead/ }));

    const link = await screen.findByRole("link", { name: /Lead criado/ });
    expect(link).toHaveAttribute("href", "/leads/lead-1");
    expect(actions.convertSearchResultToLeadAction).toHaveBeenCalledWith("a");
  });
});
