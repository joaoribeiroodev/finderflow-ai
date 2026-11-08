-- Módulo 7 — Cadências e Follow-up (ETAPA-0-AUDITORIA.md §9 item 8).
--
-- Sequências de e-mail multi-etapa, baseadas em TEMPLATE escrito por um
-- humano ao criar a cadência (nunca gerado por IA por envio — diferente
-- do Módulo 6, aqui não há IA nenhuma: é um "drip" clássico de CRM). Por
-- isso o envio automático de cada etapa não viola "nenhuma ação de IA
-- que muda dados é automática" — o humano já aprovou o conteúdo ao
-- escrever o template da etapa; o worker só executa o que já foi escrito
-- e aprovado, igual um agendador de e-mail comum.
--
-- Depende de supressão (Fase 10, risco #2 da auditoria) e do texto de
-- descadastro por organização (Módulo 6) — reaproveitados aqui, nunca
-- reimplementados.

create table public.cadences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index cadences_org_created_idx on public.cadences(organization_id, created_at desc);

create table public.cadence_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cadence_id uuid not null references public.cadences(id) on delete cascade,
  step_order smallint not null check (step_order >= 1),
  day_offset smallint not null default 0 check (day_offset >= 0),
  subject_template text not null,
  body_template text not null,
  created_at timestamptz not null default now(),
  unique (cadence_id, step_order),
  constraint cadence_steps_cadence_same_org_fk foreign key (organization_id, cadence_id)
    references public.cadences(organization_id, id) on delete cascade
);
create index cadence_steps_cadence_idx on public.cadence_steps(cadence_id, step_order);

-- Uma empresa/lead só pode estar inscrito uma vez na mesma cadência por
-- vez (`unique(cadence_id, lead_id)`) — reinscrever depois de parado é
-- uma decisão explícita de UI (cancelar a antiga e criar uma nova), não
-- um reaproveitamento silencioso da mesma linha.
create table public.cadence_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cadence_id uuid not null references public.cadences(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'stopped', 'completed')),
  current_step_order smallint not null default 0,
  next_run_at timestamptz not null default now(),
  stopped_reason text,
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  unique (organization_id, id),
  unique (cadence_id, lead_id),
  constraint cadence_enrollments_cadence_same_org_fk foreign key (organization_id, cadence_id)
    references public.cadences(organization_id, id) on delete cascade,
  constraint cadence_enrollments_lead_same_org_fk foreign key (organization_id, lead_id)
    references public.leads(organization_id, id) on delete cascade
);
-- Índice usado diretamente pelo worker (`claim`/consulta de devidos): só
-- inscrições ativas com `next_run_at` vencido.
create index cadence_enrollments_due_idx
  on public.cadence_enrollments (next_run_at)
  where status = 'active';
create index cadence_enrollments_lead_idx on public.cadence_enrollments(organization_id, lead_id);

-- Histórico append-only (mesmo princípio de `campaign_messages`/
-- `digital_presence_scores`): cada execução de etapa grava uma linha,
-- com o CONTEÚDO DE FATO ENVIADO (`rendered_subject`/`rendered_body`) —
-- nunca recalculado a partir do template, que pode ser editado depois.
create table public.cadence_step_sends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  enrollment_id uuid not null references public.cadence_enrollments(id) on delete cascade,
  step_id uuid references public.cadence_steps(id) on delete set null,
  step_order smallint not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  recipient_email text,
  rendered_subject text,
  rendered_body text,
  error_message text,
  sent_at timestamptz not null default now(),
  constraint cadence_step_sends_enrollment_same_org_fk foreign key (organization_id, enrollment_id)
    references public.cadence_enrollments(organization_id, id) on delete cascade
);
create index cadence_step_sends_enrollment_idx on public.cadence_step_sends(enrollment_id, sent_at desc);

alter table public.cadences enable row level security;
alter table public.cadence_steps enable row level security;
alter table public.cadence_enrollments enable row level security;
alter table public.cadence_step_sends enable row level security;

create policy cadences_select_member on public.cadences
  for select to authenticated using (public.is_org_member(organization_id));
create policy cadences_insert_editor on public.cadences
  for insert to authenticated with check (public.can_edit_org(organization_id));
create policy cadences_update_editor on public.cadences
  for update to authenticated using (public.can_edit_org(organization_id)) with check (public.can_edit_org(organization_id));

create policy cadence_steps_select_member on public.cadence_steps
  for select to authenticated using (public.is_org_member(organization_id));
create policy cadence_steps_insert_editor on public.cadence_steps
  for insert to authenticated with check (public.can_edit_org(organization_id));
create policy cadence_steps_update_editor on public.cadence_steps
  for update to authenticated using (public.can_edit_org(organization_id)) with check (public.can_edit_org(organization_id));
create policy cadence_steps_delete_editor on public.cadence_steps
  for delete to authenticated using (public.can_edit_org(organization_id));

create policy cadence_enrollments_select_member on public.cadence_enrollments
  for select to authenticated using (public.is_org_member(organization_id));
create policy cadence_enrollments_insert_editor on public.cadence_enrollments
  for insert to authenticated with check (public.can_edit_org(organization_id));
create policy cadence_enrollments_update_editor on public.cadence_enrollments
  for update to authenticated using (public.can_edit_org(organization_id)) with check (public.can_edit_org(organization_id));

-- Append-only — sem policy de update/delete para `authenticated` (mesmo
-- princípio de `campaign_messages`/`digital_presence_scores`).
create policy cadence_step_sends_select_member on public.cadence_step_sends
  for select to authenticated using (public.is_org_member(organization_id));
create policy cadence_step_sends_insert_editor on public.cadence_step_sends
  for insert to authenticated with check (public.can_edit_org(organization_id));
