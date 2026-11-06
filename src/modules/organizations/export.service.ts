import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Exportação de dados da organização (Configurações → Privacidade e
 * segurança, fase de hardening). Cobre os dados de negócio reais da
 * organização — a ideia de portabilidade de dados — e deliberadamente
 * NÃO inclui: credenciais/segredos (`organization_integration_credentials`
 * nunca é lido aqui), logs internos de IA/uso/billing, nem resultados de
 * busca de prospecção (grandes e já efêmeros por design — ver
 * `expires_at` em `search_results`). Cada tabela é filtrada por
 * `organization_id` mesmo a RLS já escopando isso — defesa em
 * profundidade, mesmo princípio usado no resto do projeto.
 */
export interface OrganizationExportBundle {
  exportedAt: string;
  organizationId: string;
  data: Record<string, unknown[]>;
}

const EXPORTABLE_TABLES = [
  "companies",
  "contacts",
  "leads",
  "lead_stage_history",
  "interactions",
  "tasks",
  "pipeline_stages",
  "services",
  "proposals",
  "proposal_items",
  "deals",
  "contract_charges",
  "outreach_emails",
] as const;

export async function exportOrganizationData(
  supabase: Supabase,
  organizationId: string,
): Promise<OrganizationExportBundle> {
  const data: Record<string, unknown[]> = {};

  for (const table of EXPORTABLE_TABLES) {
    const { data: rows, error } = await supabase
      .from(table)
      .select("*")
      .eq("organization_id", organizationId);

    if (error) {
      // Tabelas adicionadas em fases futuras podem não existir ainda em
      // todo ambiente — não falha a exportação inteira por isso, só
      // registra e segue com o restante.
      logger.error("Falha ao exportar tabela da organização", {
        error: error.message,
        table,
        organizationId,
      });
      data[table] = [];
      continue;
    }

    data[table] = rows ?? [];
  }

  return {
    exportedAt: new Date().toISOString(),
    organizationId,
    data,
  };
}
