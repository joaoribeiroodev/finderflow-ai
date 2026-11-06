-- Fase 9 — aprovação manual de contas, super admin, segurança de login
-- e credenciais Asaas/OpenAI configuráveis por organização.
--
-- Contexto (docs/DECISIONS.md):
-- 1. O fluxo antigo (signup -> confirma e-mail -> usa o sistema) é
--    substituído por: signup -> conta pendente -> aprovação manual do
--    super admin no painel /admin. A confirmação de e-mail do Supabase
--    Auth (toggle "Confirm email") precisa ser desativada no painel do
--    Supabase pelo próprio usuário — não existe API/MCP para isso.
-- 2. Uma conta "super admin" (plataforma, não por organização) tem
--    acesso liberado independente do approval_status da organização.
--    Resolvido via tabela platform_admin_emails + trigger: quando o
--    e-mail bate, o profile já nasce com is_super_admin = true.
-- 3. Limite mensal de IA ligado a "plano" é removido (Fase 9 também
--    remove plans/billing no código — ver migration de limpeza
--    separada); cada organização paga direto na própria conta OpenAI.
-- 4. Credenciais sensíveis (chave Asaas, chave OpenAI) por organização
--    nunca ficam em texto puro em tabela normal: usamos a extensão
--    supabase_vault (já instalada neste projeto) — o valor plano só é
--    lido por função SECURITY DEFINER restrita a service_role, nunca
--    por uma query comum nem pelo cliente autenticado no browser.

-- ===========================================================================
-- 1. Super admin de plataforma
-- ===========================================================================

alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

create table public.platform_admin_emails (
  email text primary key
);
-- Sem policies: tabela de bootstrap, só lida pelo trigger (security definer)
-- e gerida via SQL direto/migration. Nunca exposta a authenticated/anon.
alter table public.platform_admin_emails enable row level security;

insert into public.platform_admin_emails (email) values ('jpeddro0706@gmail.com');

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, is_super_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    exists (select 1 from public.platform_admin_emails pae where pae.email = lower(new.email))
  )
  on conflict (id) do update set is_super_admin = excluded.is_super_admin
  where public.profiles.is_super_admin is distinct from excluded.is_super_admin;
  return new;
end;
$$;

-- Backfill: promove qualquer conta já existente cujo e-mail já esteja
-- na lista de super admins (cobre o caso de a conta ter sido criada
-- antes desta migration).
update public.profiles p
set is_super_admin = true
from auth.users u
where u.id = p.id
  and lower(u.email) in (select email from public.platform_admin_emails)
  and p.is_super_admin = false;

create or replace function public.is_platform_super_admin()
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select coalesce((select pr.is_super_admin from public.profiles pr where pr.id = auth.uid()), false);
$$;
revoke all on function public.is_platform_super_admin() from public;
grant execute on function public.is_platform_super_admin() to authenticated;

-- ===========================================================================
-- 2. Aprovação manual de organizações
-- ===========================================================================

alter table public.organizations
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists approval_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists approval_reviewed_at timestamptz,
  add column if not exists approval_notes text;

-- Super admin pode ver e revisar (aprovar/rejeitar) qualquer organização,
-- além das próprias (já cobertas por organizations_select_member).
create policy organizations_select_super_admin on public.organizations
  for select to authenticated using (public.is_platform_super_admin());

create policy organizations_update_super_admin on public.organizations
  for update to authenticated using (public.is_platform_super_admin()) with check (public.is_platform_super_admin());

-- Super admin também precisa ver quem é o owner de cada organização
-- pendente (nome/e-mail) para decidir a aprovação.
create policy members_select_super_admin on public.organization_members
  for select to authenticated using (public.is_platform_super_admin());

create policy profiles_select_super_admin on public.profiles
  for select to authenticated using (public.is_platform_super_admin());

-- ===========================================================================
-- 3. Rate limit / lockout de tentativas de login
-- ===========================================================================

create table public.auth_login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index auth_login_attempts_email_created_idx
  on public.auth_login_attempts (lower(email), created_at desc);

-- Sem policies para authenticated/anon — mesmo padrão de audit_logs:
-- só a Server Action (via cliente admin/service role) grava e lê aqui,
-- nunca o browser diretamente.
alter table public.auth_login_attempts enable row level security;

-- ===========================================================================
-- 4. Credenciais Asaas/OpenAI por organização (Supabase Vault)
-- ===========================================================================

create table public.organization_integration_credentials (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  asaas_environment text not null default 'sandbox' check (asaas_environment in ('sandbox', 'production')),
  asaas_secret_id uuid references vault.secrets(id) on delete set null,
  asaas_configured_at timestamptz,
  openai_secret_id uuid references vault.secrets(id) on delete set null,
  openai_model text,
  openai_configured_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.organization_integration_credentials enable row level security;

-- Leitura liberada para admins/owners da própria org (só metadados —
-- o valor da chave nunca está nesta tabela, apenas o id do secret no Vault).
create policy org_credentials_select_admin on public.organization_integration_credentials
  for select to authenticated using (public.can_admin_org(organization_id));

-- Sem policies de insert/update/delete: toda escrita passa pelas funções
-- abaixo (security definer), que validam o papel do usuário na organização
-- antes de tocar no Vault — nunca um UPDATE direto client-side.

create or replace function public.set_org_asaas_credentials(p_org uuid, p_api_key text, p_environment text)
returns void
language plpgsql
security definer
set search_path = public, vault, auth
as $$
declare
  v_secret_id uuid;
begin
  if not public.can_admin_org(p_org) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_environment not in ('sandbox', 'production') then
    raise exception 'invalid environment' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_api_key, ''))) = 0 then
    raise exception 'empty api key' using errcode = '22023';
  end if;

  select asaas_secret_id into v_secret_id
  from public.organization_integration_credentials
  where organization_id = p_org;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_api_key);
  else
    v_secret_id := vault.create_secret(p_api_key, 'asaas_api_key:' || p_org::text);
  end if;

  insert into public.organization_integration_credentials (organization_id, asaas_secret_id, asaas_environment, asaas_configured_at, updated_at)
  values (p_org, v_secret_id, p_environment, now(), now())
  on conflict (organization_id) do update
    set asaas_secret_id = excluded.asaas_secret_id,
        asaas_environment = excluded.asaas_environment,
        asaas_configured_at = now(),
        updated_at = now();
end;
$$;
revoke all on function public.set_org_asaas_credentials(uuid, text, text) from public;
grant execute on function public.set_org_asaas_credentials(uuid, text, text) to authenticated;

create or replace function public.clear_org_asaas_credentials(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, vault, auth
as $$
declare
  v_secret_id uuid;
begin
  if not public.can_admin_org(p_org) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select asaas_secret_id into v_secret_id
  from public.organization_integration_credentials
  where organization_id = p_org;

  update public.organization_integration_credentials
  set asaas_secret_id = null, asaas_configured_at = null, updated_at = now()
  where organization_id = p_org;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;
revoke all on function public.clear_org_asaas_credentials(uuid) from public;
grant execute on function public.clear_org_asaas_credentials(uuid) to authenticated;

create or replace function public.set_org_openai_credentials(p_org uuid, p_api_key text, p_model text default null)
returns void
language plpgsql
security definer
set search_path = public, vault, auth
as $$
declare
  v_secret_id uuid;
begin
  if not public.can_admin_org(p_org) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_api_key, ''))) = 0 then
    raise exception 'empty api key' using errcode = '22023';
  end if;

  select openai_secret_id into v_secret_id
  from public.organization_integration_credentials
  where organization_id = p_org;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_api_key);
  else
    v_secret_id := vault.create_secret(p_api_key, 'openai_api_key:' || p_org::text);
  end if;

  insert into public.organization_integration_credentials (organization_id, openai_secret_id, openai_model, openai_configured_at, updated_at)
  values (p_org, v_secret_id, p_model, now(), now())
  on conflict (organization_id) do update
    set openai_secret_id = excluded.openai_secret_id,
        openai_model = excluded.openai_model,
        openai_configured_at = now(),
        updated_at = now();
end;
$$;
revoke all on function public.set_org_openai_credentials(uuid, text, text) from public;
grant execute on function public.set_org_openai_credentials(uuid, text, text) to authenticated;

create or replace function public.clear_org_openai_credentials(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, vault, auth
as $$
declare
  v_secret_id uuid;
begin
  if not public.can_admin_org(p_org) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select openai_secret_id into v_secret_id
  from public.organization_integration_credentials
  where organization_id = p_org;

  update public.organization_integration_credentials
  set openai_secret_id = null, openai_model = null, openai_configured_at = null, updated_at = now()
  where organization_id = p_org;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;
revoke all on function public.clear_org_openai_credentials(uuid) from public;
grant execute on function public.clear_org_openai_credentials(uuid) to authenticated;

-- Leitura do valor em texto puro: EXCLUSIVO do backend (service role) no
-- momento de efetivamente chamar a API da Asaas/OpenAI em nome da org.
-- Nunca concedido a authenticated — o segredo não deve nem transitar
-- por uma query client-side, só pelo servidor no momento do uso.
create or replace function public.get_org_asaas_api_key(p_org uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_key text;
begin
  select ds.decrypted_secret into v_key
  from vault.decrypted_secrets ds
  join public.organization_integration_credentials c on c.asaas_secret_id = ds.id
  where c.organization_id = p_org;
  return v_key;
end;
$$;
revoke all on function public.get_org_asaas_api_key(uuid) from public;
revoke all on function public.get_org_asaas_api_key(uuid) from authenticated;
grant execute on function public.get_org_asaas_api_key(uuid) to service_role;

create or replace function public.get_org_openai_api_key(p_org uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_key text;
begin
  select ds.decrypted_secret into v_key
  from vault.decrypted_secrets ds
  join public.organization_integration_credentials c on c.openai_secret_id = ds.id
  where c.organization_id = p_org;
  return v_key;
end;
$$;
revoke all on function public.get_org_openai_api_key(uuid) from public;
revoke all on function public.get_org_openai_api_key(uuid) from authenticated;
grant execute on function public.get_org_openai_api_key(uuid) to service_role;
