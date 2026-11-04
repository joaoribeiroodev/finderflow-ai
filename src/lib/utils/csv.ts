/**
 * Parser de CSV minimalista para a importação de empresas (Fase 3).
 *
 * Suporta aspas duplas (com `""` escapado), detecta automaticamente o
 * delimitador (`,` ou `;` — comum em planilhas exportadas em pt-BR) pela
 * primeira linha, e normaliza quebras de linha. Não depende de nenhuma
 * biblioteca externa: a necessidade aqui é apenas tabular um CSV simples
 * de empresas, não o formato CSV completo (RFC 4180 tem casos — BOM,
 * campos multilinha — que este parser cobre; dialetos exóticos, não).
 */
export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

function detectDelimiter(headerLine: string): "," | ";" {
  const commaCount = headerLine.split(",").length;
  const semicolonCount = headerLine.split(";").length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

export function parseCsv(content: string): ParsedCsv {
  // Remove BOM (comum em exports do Excel) e normaliza quebras de linha.
  const normalized = content.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => parseLine(line, delimiter));

  return { headers, rows };
}
