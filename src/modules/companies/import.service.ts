import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import { parseCsv } from "@/lib/utils/csv";
import { companyCsvRowSchema, type CsvTargetFieldKey } from "@/lib/validation/companies";
import type { Database } from "@/types/database";

import { createCompany, DuplicateCompanyError } from "./companies.service";

type Supabase = SupabaseClient<Database>;

export type ColumnMapping = Partial<Record<CsvTargetFieldKey, number>>;

export interface RowError {
  line: number;
  values: Record<string, string>;
  errors: string[];
}

export interface ValidatedRow {
  line: number;
  data: Record<CsvTargetFieldKey, string | undefined>;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: ValidatedRow[];
  errorRows: RowError[];
}

/**
 * Aplica o mapeamento de colunas escolhido pelo usuário e valida cada
 * linha com `companyCsvRowSchema`. Nunca confia em uma validação feita
 * no cliente — isso é reexecutado aqui, do CSV bruto, antes de qualquer
 * gravação (critério de aceite da Fase 3: "preview, validação e
 * relatório de erros").
 */
export function validateCsvRows(
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping,
): ValidationSummary {
  const validRows: ValidatedRow[] = [];
  const errorRows: RowError[] = [];

  rows.forEach((row, index) => {
    const line = index + 2; // +1 cabeçalho, +1 para base-1 (linha legível pro usuário)
    const mapped: Record<string, string> = {};

    for (const [field, columnIndex] of Object.entries(mapping)) {
      if (columnIndex === undefined || columnIndex === null) continue;
      mapped[field] = (row[columnIndex] ?? "").trim();
    }

    const parsed = companyCsvRowSchema.safeParse(mapped);
    if (!parsed.success) {
      errorRows.push({
        line,
        values: mapped,
        errors: parsed.error.issues.map((issue) => issue.message),
      });
      return;
    }

    validRows.push({ line, data: parsed.data as Record<CsvTargetFieldKey, string | undefined> });
  });

  return { totalRows: rows.length, validRows, errorRows };
}

export { parseCsv };

export interface ImportRunResult {
  jobId: string;
  created: number;
  duplicates: number;
  failed: number;
  total: number;
}

/**
 * Cria o registro de `import_jobs` e processa as linhas já validadas.
 *
 * Processamento é síncrono (sem worker/cron decidido ainda — ver
 * docs/DECISIONS.md). Linhas com duplicata (CNPJ ou domínio do site já
 * cadastrado) NUNCA são mescladas automaticamente: ficam fora, contadas
 * em `duplicates` e listadas no relatório de erros para revisão manual —
 * dedupe automático em lote é exatamente o que docs/03-database.md §3.4
 * proíbe ("não fundir empresas automaticamente apenas pelo nome").
 */
export async function runImport(
  supabase: Supabase,
  organizationId: string,
  userId: string,
  fileName: string,
  validation: ValidationSummary,
): Promise<ImportRunResult> {
  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      file_name: fileName,
      total_rows: validation.totalRows,
      status: "processing",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    logger.error("Falha ao criar import_job", { error: jobError?.message, organizationId });
    throw new Error("Não foi possível iniciar a importação.");
  }

  let created = 0;
  let duplicates = 0;
  let commitFailures = 0;
  const errorReport: Array<{ line: number; name: string; reason: string }> = validation.errorRows.map(
    (row) => ({ line: row.line, name: row.values.name ?? "(sem nome)", reason: row.errors.join("; ") }),
  );

  for (const row of validation.validRows) {
    try {
      await createCompany(
        supabase,
        organizationId,
        {
          name: row.data.name ?? "",
          cnpj: row.data.cnpj,
          category: row.data.category,
          website: row.data.website,
          phone: row.data.phone,
          email: row.data.email,
          city: row.data.city,
          state: row.data.state,
        },
        { origin: "csv", confirmDuplicate: false },
      );
      created += 1;
    } catch (error) {
      if (error instanceof DuplicateCompanyError) {
        duplicates += 1;
        errorReport.push({ line: row.line, name: row.data.name ?? "", reason: error.message });
        continue;
      }
      commitFailures += 1;
      errorReport.push({
        line: row.line,
        name: row.data.name ?? "",
        reason: error instanceof Error ? error.message : "Falha desconhecida ao importar.",
      });
    }
  }

  const failed = validation.errorRows.length + commitFailures;

  const { error: updateError } = await supabase
    .from("import_jobs")
    .update({
      status: "completed",
      summary: { total: validation.totalRows, created, duplicates, failed },
      error_report: errorReport,
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (updateError) {
    logger.error("Falha ao finalizar import_job", { error: updateError.message, jobId: job.id });
  }

  return { jobId: job.id, created, duplicates, failed, total: validation.totalRows };
}
