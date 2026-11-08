import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Mail, Phone, MapPin } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";
import { getCompanyById, getActiveLeadIdForCompany } from "@/modules/companies/companies.service";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConvertToLeadButton } from "@/components/companies/convert-to-lead-button";
import { CompanyEnrichmentSection } from "@/components/companies/company-enrichment-section";
import { DigitalPresenceScoreCard } from "@/components/companies/digital-presence-score-card";
import { CompanyAnalysisSection } from "@/components/ai/company-analysis-section";
import { listCompanyAnalyses } from "@/modules/ai/company-analyzer.service";
import { listPendingEnrichmentFields } from "@/modules/companies/enrichment/enrichment.service";
import { getLatestDigitalPresenceScore } from "@/modules/companies/scoring/digital-presence-score.service";
import type { CompanyAnalysis } from "@/lib/ai/schemas";
import { formatCnpj } from "@/lib/utils/normalize";
import { formatRelativeDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Empresa — FinderFlow AI" };

interface CompanyAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activeOrganization = await requireActiveOrganization();
  const supabase = await createClient();

  const company = await getCompanyById(supabase, activeOrganization.organizationId, id);
  if (!company) notFound();

  const activeLeadId = await getActiveLeadIdForCompany(supabase, activeOrganization.organizationId, id);
  const pendingEnrichmentFields = await listPendingEnrichmentFields(supabase, activeOrganization.organizationId, id);
  const latestScore = await getLatestDigitalPresenceScore(supabase, activeOrganization.organizationId, id);
  const analyses = await listCompanyAnalyses(supabase, activeOrganization.organizationId, id);
  const latestAnalysis = (analyses[0]?.result ?? null) as CompanyAnalysis | null;
  const address = (company.address ?? {}) as CompanyAddress;
  const hasAddress = Boolean(address.street || address.city || address.state || address.zipCode);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/companies"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar para empresas
      </Link>

      <PageHeader
        eyebrow="Empresa"
        title={company.name}
        subtitle={`Cadastrada ${formatRelativeDateTime(company.created_at)}.`}
        actions={
          activeLeadId ? (
            <Badge variant="success">Já é um lead ativo</Badge>
          ) : (
            <ConvertToLeadButton companyId={company.id} />
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Dados de contato" />
          {/* Não é uma lista de definições de fato (sem par termo/descrição
              por item), por isso não usa <dl>/<dt>/<dd> — achado do axe-core
              (definition-list) corrigido na Fase 8. */}
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-[var(--ff-text-muted)]" aria-hidden />
              <span className="text-[var(--ff-text-primary)]">{company.phone ?? "Não informado"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-[var(--ff-text-muted)]" aria-hidden />
              <span className="text-[var(--ff-text-primary)]">{company.email ?? "Não informado"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-[var(--ff-text-muted)]" aria-hidden />
              {company.website ? (
                <a
                  href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[var(--ff-violet-glow)] hover:underline"
                >
                  {company.website}
                </a>
              ) : (
                <span className="text-[var(--ff-text-primary)]">Não informado</span>
              )}
            </div>
            {hasAddress ? (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 text-[var(--ff-text-muted)]" aria-hidden />
                <span className="text-[var(--ff-text-primary)]">
                  {[address.street, address.city, address.state, address.zipCode].filter(Boolean).join(", ")}
                </span>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader title="Identificação" />
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-xs text-[var(--ff-text-muted)] uppercase">CNPJ</dt>
              <dd className="text-[var(--ff-text-primary)]">{formatCnpj(company.cnpj) ?? "Não informado"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--ff-text-muted)] uppercase">Categoria</dt>
              <dd className="text-[var(--ff-text-primary)]">{company.category ?? "Não informado"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--ff-text-muted)] uppercase">Origem do cadastro</dt>
              <dd>
                <Badge variant="outline">{company.origin}</Badge>
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <DigitalPresenceScoreCard companyId={company.id} latestScore={latestScore} />

      <CompanyEnrichmentSection companyId={company.id} initialFields={pendingEnrichmentFields} />

      <CompanyAnalysisSection companyId={company.id} initialAnalysis={latestAnalysis} />

      <Card>
        <CardHeader title="Contatos, interações e histórico" subtitle="Disponível no detalhe do lead" />
        <p className="text-sm text-[var(--ff-text-secondary)]">
          Pessoas de contato, timeline de interações e tarefas aparecem no detalhe do lead desta empresa
          (quando ela for convertida em lead — ver botão acima).
        </p>
      </Card>
    </div>
  );
}
