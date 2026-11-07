-- Módulo 1 — Enriquecimento Inteligente de Empresas.
--
-- Tabela de propostas de campo, nunca grava direto nas colunas de
-- `companies` — cada achado fica `pending` até um humano aceitar ou
-- rejeitar (ver src/modules/companies/enrichment/enrichment.service.ts).
-- `is_ai_inferred` fica reservado para uma extração baseada em IA no
-- futuro; esta fase usa só extração determinística via regex sobre o
-- HTML do próprio site da empresa (mailto:/tel:/links de rede social) —
-- decisão deliberada para não inventar fatos e não gastar custo de IA
-- numa tarefa que não precisa de interpretação.
create table public.company_enrichment_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  field_key text not null,
  field_value text not null,
  source text not null,
  confidence numeric(3, 2) not null default 1.00 check (confidence >= 0 and confidence <= 1),
  is_ai_inferred boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  discovered_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Evita duplicar a mesma proposta pendente em re-scans sucessivos.
  unique (company_id, field_key, field_value),
  constraint company_enrichment_fields_company_same_org_fk foreign key (organization_id, company_id)
    references public.companies(organization_id, id) on delete cascade
);
create index company_enrichment_fields_pending_idx
  on public.company_enrichment_fields(company_id, discovered_at desc)
  where status = 'pending';

alter table public.company_enrichment_fields enable row level security;

create policy company_enrichment_fields_select_member on public.company_enrichment_fields
  for select to authenticated using (public.is_org_member(organization_id));

create policy company_enrichment_fields_insert_editor on public.company_enrichment_fields
  for insert to authenticated with check (public.can_edit_org(organization_id));

create policy company_enrichment_fields_update_editor on public.company_enrichment_fields
  for update to authenticated using (public.can_edit_org(organization_id)) with check (public.can_edit_org(organization_id));

create policy company_enrichment_fields_delete_admin on public.company_enrichment_fields
  for delete to authenticated using (public.can_admin_org(organization_id));
