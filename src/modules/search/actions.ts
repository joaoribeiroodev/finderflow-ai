"use server";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { logger } from "@/lib/logger/logger";

export interface SearchResult {
  id: string;
  kind: "company" | "lead" | "page";
  title: string;
  subtitle: string | null;
  href: string;
}

/**
 * Busca global simples (⌘K) — empresas e leads da organização ativa por
 * nome. Não é full-text search nem ranqueada; é um `ilike` direto,
 * suficiente para o volume atual. Scoping por `organization_id` vem
 * tanto da RLS quanto do filtro explícito aqui (mesmo princípio de
 * defesa em profundidade das demais queries "da minha organização").
 */
export async function searchWorkspaceAction(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const org = await requireActiveOrganization();
  const supabase = await createClient();
  const like = `%${trimmed}%`;

  const [{ data: companies, error: companiesError }, { data: leads, error: leadsError }] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id, name, category")
        .eq("organization_id", org.organizationId)
        .ilike("name", like)
        .limit(8),
      supabase
        .from("leads")
        .select("id, status, company:companies!inner ( name )")
        .eq("organization_id", org.organizationId)
        .ilike("company.name", like)
        .limit(8),
    ]);

  if (companiesError) {
    logger.error("Falha ao buscar empresas na busca global", { error: companiesError.message });
  }
  if (leadsError) {
    logger.error("Falha ao buscar leads na busca global", { error: leadsError.message });
  }

  const results: SearchResult[] = [];

  for (const c of companies ?? []) {
    results.push({
      id: c.id,
      kind: "company",
      title: c.name,
      subtitle: c.category,
      href: `/companies/${c.id}`,
    });
  }

  for (const l of leads ?? []) {
    if (!l.company) continue;
    results.push({
      id: l.id,
      kind: "lead",
      title: l.company.name,
      subtitle: `Lead · ${l.status}`,
      href: `/leads/${l.id}`,
    });
  }

  return results;
}
