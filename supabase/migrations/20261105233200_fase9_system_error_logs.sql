-- Fase 9: log de erros/warnings da aplicação para o painel /admin
-- (integrado ao logger estruturado server-side). Mesmo padrão de
-- auth_login_attempts: RLS habilitada, sem policies para
-- authenticated/anon — só o cliente admin (service_role) grava e lê,
-- e a leitura no painel é sempre gated por is_platform_super_admin()
-- em código de aplicação.
create table public.system_error_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('warn', 'error')),
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index system_error_logs_created_idx on public.system_error_logs (created_at desc);

alter table public.system_error_logs enable row level security;
