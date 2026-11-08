-- Módulo 4 — Lead Scoring 2.0 (decompõe o placar único do Lead Scorer —
-- Fase 5 — em 3 dimensões: potencial, aderência e prioridade; ver
-- ETAPA-0-AUDITORIA.md seção 7: "O campo único de score hoje existente
-- pode continuar como 'cache do valor atual'" — `leads.score` não é
-- removido nem deixa de ser atualizado).
--
-- Histórico, nunca sobrescreve (mesmo princípio de `digital_presence_scores`
-- do Módulo 3): cada qualificação grava uma linha nova.
create table public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  potential_score smallint not null check (potential_score >= 0 and potential_score <= 100),
  fit_score smallint not null check (fit_score >= 0 and fit_score <= 100),
  priority_score smallint not null check (priority_score >= 0 and priority_score <= 100),
  weights jsonb not null default '{}'::jsonb,
  model text not null,
  prompt_version text not null,
  computed_at timestamptz not null default now(),
  constraint lead_scores_lead_same_org_fk foreign key (organization_id, lead_id)
    references public.leads(organization_id, id) on delete cascade
);
create index lead_scores_lead_latest_idx on public.lead_scores(lead_id, computed_at desc);

alter table public.lead_scores enable row level security;

create policy lead_scores_select_member on public.lead_scores
  for select to authenticated using (public.is_org_member(organization_id));

-- Append-only, mesmo padrão de `digital_presence_scores`.
create policy lead_scores_insert_editor on public.lead_scores
  for insert to authenticated with check (public.can_edit_org(organization_id));
