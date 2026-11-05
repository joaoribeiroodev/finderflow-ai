-- Fase 3 — tabela de auditoria/job de importação CSV de empresas.
--
-- Não há worker/cron decidido ainda (ver "Decisões pendentes" #6 em
-- docs/DECISIONS.md), então o processamento da importação é síncrono
-- dentro da própria Server Action. Ainda assim, cada importação gera uma
-- linha aqui para que o usuário possa consultar o resultado depois
-- (critério de aceite da Fase 3: "consultar resultado de importação"),
-- com o mesmo propósito de auditoria que um job assíncrono real teria.
--
-- `file_path` fica nulo por enquanto: não existe bucket de Storage
-- configurado neste projeto (decisão não tomada ainda), então o CSV é
-- lido em memória a partir do upload e descartado — apenas o nome do
-- arquivo e o resultado (summary/error_report) são persistidos.
create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_path text,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  total_rows integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  error_report jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.import_jobs is
  'Auditoria de importações CSV de empresas. Processamento é síncrono nesta fase (sem worker/cron ainda decidido) — a linha serve de registro consultável, não de fila real.';

create index import_jobs_org_created_idx on public.import_jobs (organization_id, created_at desc);

alter table public.import_jobs enable row level security;

-- Mesmo padrão aplicado às demais tabelas tenant-scoped (ver migration
-- 20261104143307_core_schema.sql): leitura para qualquer membro, escrita
-- para quem pode editar dados da organização, exclusão restrita a admin.
create policy import_jobs_select_member on public.import_jobs
  for select to authenticated using (public.is_org_member(organization_id));

create policy import_jobs_insert_editor on public.import_jobs
  for insert to authenticated with check (public.can_edit_org(organization_id));

create policy import_jobs_update_editor on public.import_jobs
  for update to authenticated using (public.can_edit_org(organization_id))
  with check (public.can_edit_org(organization_id));

create policy import_jobs_delete_admin on public.import_jobs
  for delete to authenticated using (public.can_admin_org(organization_id));
