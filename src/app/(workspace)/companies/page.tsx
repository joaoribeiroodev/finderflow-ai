import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus, Upload } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { listCompanies, listCompanyCategories } from "@/modules/companies/companies.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCnpj } from "@/lib/utils/normalize";
import { formatRelativeDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Empresas — FinderFlow AI" };

const ORIGIN_LABEL: Record<string, string> = {
  manual: "Manual",
  csv: "CSV",
  provider: "Provedor",
  referral: "Indicação",
  other: "Outro",
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const page = Number(params.page ?? "1") || 1;
  const [{ companies, total, pageSize }, categories] = await Promise.all([
    listCompanies(supabase, activeOrganization.organizationId, {
      search: params.q,
      category: params.category,
      page,
    }),
    listCompanyCategories(supabase, activeOrganization.organizationId),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Prospecção"
        title="Empresas"
        subtitle={`${total.toLocaleString("pt-BR")} empresa${total === 1 ? "" : "s"} cadastrada${total === 1 ? "" : "s"} nesta organização.`}
        actions={
          <>
            <Link href="/companies/import">
              <Button variant="secondary" size="sm">
                <Upload className="mr-2 size-4" aria-hidden /> Importar CSV
              </Button>
            </Link>
            <Link href="/companies/new">
              <Button size="sm">
                <Plus className="mr-2 size-4" aria-hidden /> Nova empresa
              </Button>
            </Link>
          </>
        }
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3" action="/companies">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label htmlFor="q" className="text-sm font-medium text-[var(--ff-text-secondary)]">
              Buscar por nome ou CNPJ
            </label>
            <input
              id="q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Ex.: Padaria São José ou 12.345.678/0001-95"
              className="h-11 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 text-[var(--ff-text-primary)] outline-none placeholder:text-[var(--ff-text-muted)] focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
            />
          </div>
          <div className="flex min-w-[180px] flex-col gap-1.5">
            <label htmlFor="category" className="text-sm font-medium text-[var(--ff-text-secondary)]">
              Categoria
            </label>
            <select
              id="category"
              name="category"
              defaultValue={params.category ?? ""}
              className="h-11 rounded-xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] px-3.5 text-[var(--ff-text-primary)] outline-none focus-visible:border-[var(--ff-purple-500)] focus-visible:ring-2 focus-visible:ring-[var(--ff-purple-500)]"
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary" size="md">
            Filtrar
          </Button>
        </form>
      </Card>

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={total === 0 && !params.q && !params.category ? "Nenhuma empresa cadastrada ainda" : "Nenhuma empresa encontrada"}
          description={
            total === 0 && !params.q && !params.category
              ? "Cadastre manualmente ou importe uma planilha CSV para começar a prospectar."
              : "Ajuste a busca ou os filtros para ver outras empresas."
          }
          action={
            total === 0 && !params.q && !params.category ? (
              <Link href="/companies/new">
                <Button size="sm">
                  <Plus className="mr-2 size-4" aria-hidden /> Cadastrar primeira empresa
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--ff-border-subtle)] text-xs text-[var(--ff-text-muted)] uppercase">
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">CNPJ</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 font-medium">Origem</th>
                <th className="px-5 py-3 font-medium">Cadastrada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d243c]">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-[var(--ff-bg-elevated)]/60">
                  <td className="px-5 py-3">
                    <Link
                      href={`/companies/${company.id}`}
                      className="font-medium text-[var(--ff-text-primary)] hover:text-[var(--ff-violet-glow)]"
                    >
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-[var(--ff-text-secondary)]">
                    {formatCnpj(company.cnpj) ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-[var(--ff-text-secondary)]">{company.category ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge variant="outline">{ORIGIN_LABEL[company.origin] ?? company.origin}</Badge>
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--ff-text-muted)]">
                    {formatRelativeDateTime(company.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={{
                pathname: "/companies",
                query: { ...(params.q ? { q: params.q } : {}), ...(params.category ? { category: params.category } : {}), page: p },
              }}
              className={`flex size-9 items-center justify-center rounded-lg border ${
                p === page
                  ? "border-[var(--ff-purple-500)] bg-[var(--ff-purple-600)] text-white"
                  : "border-[var(--ff-border-subtle)] text-[var(--ff-text-secondary)] hover:border-[var(--ff-purple-500)]"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
