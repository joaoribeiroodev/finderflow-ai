import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("separa cabeçalho e linhas por vírgula", () => {
    const result = parseCsv("nome,cnpj\nEmpresa A,12345678000195\nEmpresa B,");
    expect(result.headers).toEqual(["nome", "cnpj"]);
    expect(result.rows).toEqual([
      ["Empresa A", "12345678000195"],
      ["Empresa B", ""],
    ]);
  });

  it("detecta delimitador ponto-e-vírgula", () => {
    const result = parseCsv("nome;telefone\nEmpresa A;71999999999");
    expect(result.headers).toEqual(["nome", "telefone"]);
    expect(result.rows).toEqual([["Empresa A", "71999999999"]]);
  });

  it("respeita campos entre aspas com vírgula/ponto-e-vírgula interno e aspas escapadas", () => {
    const result = parseCsv('nome,endereco\n"Empresa A","Rua 1, n. 2 ""centro"""');
    expect(result.rows).toEqual([["Empresa A", 'Rua 1, n. 2 "centro"']]);
  });

  it("remove BOM e ignora linhas em branco", () => {
    const result = parseCsv("﻿nome,cnpj\n\nEmpresa A,123\n\n");
    expect(result.headers).toEqual(["nome", "cnpj"]);
    expect(result.rows).toEqual([["Empresa A", "123"]]);
  });

  it("retorna vazio para conteúdo vazio", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});
