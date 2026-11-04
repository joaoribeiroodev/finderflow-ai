"use server";

import { createClient } from "@/lib/supabase/server";
import { assertCanEditOrganization, PermissionError } from "@/lib/permissions/permissions";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { parseCsv } from "@/lib/utils/csv";

import { runImport, validateCsvRows, type ColumnMapping } from "./import.service";
import type { ImportRunResult } from "./import.service";

export interface ImportActionResult {
  success: boolean;
  message?: string;
  result?: ImportRunResult;
}

export async function importCompaniesAction(
  _prev: ImportActionResult,
  formData: FormData,
): Promise<ImportActionResult> {
  const csvText = formData.get("csvText");
  const fileName = formData.get("fileName");
  const mappingRaw = formData.get("mapping");

  if (typeof csvText !== "string" || csvText.trim().length === 0) {
    return { success: false, message: "Nenhum arquivo CSV foi enviado." };
  }
  if (typeof mappingRaw !== "string") {
    return { success: false, message: "Mapeamento de colunas ausente." };
  }

  let mapping: ColumnMapping;
  try {
    mapping = JSON.parse(mappingRaw);
  } catch {
    return { success: false, message: "Mapeamento de colunas inválido." };
  }

  if (mapping.name === undefined) {
    return { success: false, message: "Mapeie a coluna de Nome antes de continuar." };
  }

  const { headers, rows } = parseCsv(csvText);
  if (rows.length === 0) {
    return { success: false, message: "O arquivo não tem linhas de dados." };
  }
  if (rows.length > 2000) {
    return {
      success: false,
      message: "Arquivo com mais de 2000 linhas — divida em arquivos menores (processamento é síncrono nesta fase).",
    };
  }
  void headers;

  const validation = validateCsvRows(headers, rows, mapping);

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "Sessão expirada. Faça login novamente." };
  }

  try {
    await assertCanEditOrganization(supabase, organizationId);
    const result = await runImport(
      supabase,
      organizationId,
      user.id,
      typeof fileName === "string" && fileName.length > 0 ? fileName : "importacao.csv",
      validation,
    );
    return { success: true, result };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { success: false, message: error.message };
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : "Não foi possível concluir a importação.",
    };
  }
}
