-- Módulo 3 — Digital Presence Score (depende do Módulo 1 estar emitindo
-- dados de contato/redes sociais — ver ETAPA-0-AUDITORIA.md seção 9,
-- item 3: "depende do enriquecimento estar emitindo dados com
-- origem/confiança").
--
-- Histórico, nunca sobrescreve: cada recálculo insere uma nova linha
-- (mesmo princípio de `ai_usage_events`/`lead_scores` propostos na
-- auditoria — "não substituir, acumular"). `criteria` guarda os pesos
-- usados e os sinais brutos daquele cálculo, para auditar por que o
-- score mudou entre duas datas sem precisar recalcular do zero.
create table public.digital_presence_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  score smallint not null check (score >= 0 and score <= 100),
  criteria jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  constraint digital_presence_scores_company_same_org_fk foreign key (organization_id, company_id)
    references public.companies(organization_id, id) on delete cascade
);
create index digital_presence_scores_company_latest_idx
  on public.digital_presence_scores(company_id, computed_at desc);

alter table public.digital_presence_scores enable row level security;

create policy digital_presence_scores_select_member on public.digital_presence_scores
  for select to authenticated using (public.is_org_member(organization_id));

-- Append-only por design (histórico de auditoria do próprio score) —
-- de propósito sem policy de update/delete para `authenticated`.
create policy digital_presence_scores_insert_editor on public.digital_presence_scores
  for insert to authenticated with check (public.can_edit_org(organization_id));
