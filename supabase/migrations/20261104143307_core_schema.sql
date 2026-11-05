-- FinderFlow AI — migration de referência (núcleo multi-tenant)
-- Revisar/expandir em migrations incrementais antes de produção.
-- Esta migration assume Supabase com schema auth e função auth.uid().

create extension if not exists pgcrypto;

create type public.org_role as enum ('owner', 'admin', 'manager', 'member', 'viewer');
create type public.lead_priority as enum ('low', 'medium', 'high');
create type public.lead_status as enum ('open', 'won', 'lost');
create type public.task_status as enum ('pending', 'in_progress', 'completed', 'canceled');
create type public.subscription_status as enum ('incomplete', 'trialing', 'active', 'past_due', 'suspended', 'canceled', 'expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Bahia',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'member',
  status text not null default 'active' check (status in ('invited','active','suspended')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles public.org_role[])
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.org_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role[]) to authenticated;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  legal_name text,
  cnpj text,
  category text,
  description text,
  phone text,
  email text,
  website text,
  address jsonb not null default '{}'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  origin text not null default 'manual' check (origin in ('provider','csv','manual','referral','other')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index companies_org_name_idx on public.companies(organization_id, normalized_name);
create index companies_org_cnpj_idx on public.companies(organization_id, cnpj) where cnpj is not null;

create table public.company_source_refs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null,
  external_id text not null,
  attribution jsonb not null default '{}'::jsonb,
  retention_policy text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, provider, external_id),
  constraint source_refs_company_same_org_fk foreign key (organization_id, company_id)
    references public.companies(organization_id, id) on delete cascade
);

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  query text not null,
  segment text,
  state text,
  city text,
  filters jsonb not null default '{}'::jsonb,
  providers jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','canceled')),
  total_results integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, id)
);
create index searches_org_created_idx on public.searches(organization_id, created_at desc);

create table public.search_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  search_id uuid not null references public.searches(id) on delete cascade,
  company_id uuid,
  provider text not null,
  external_id text,
  display_data jsonb not null default '{}'::jsonb,
  attribution jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint search_results_company_same_org_fk foreign key (organization_id, company_id)
    references public.companies(organization_id, id) on delete restrict,
  constraint search_results_search_same_org_fk foreign key (organization_id, search_id)
    references public.searches(organization_id, id) on delete cascade
);
create index search_results_search_idx on public.search_results(organization_id, search_id);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#8B5CF6',
  position integer not null,
  is_closed boolean not null default false,
  result_type text check (result_type in ('won','lost') or result_type is null),
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, position),
  unique (organization_id, id)
);

create or replace function public.create_organization_with_defaults(org_name text, org_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if length(trim(org_name)) < 2 or length(trim(org_slug)) < 3 then
    raise exception 'invalid organization name or slug' using errcode = '22023';
  end if;
  insert into public.organizations (name, slug)
  values (trim(org_name), lower(trim(org_slug)))
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (new_org_id, auth.uid(), 'owner', 'active');

  insert into public.pipeline_stages (organization_id, name, color, position, is_closed, result_type)
  values
    (new_org_id, 'Novo', '#8B5CF6', 1, false, null),
    (new_org_id, 'Qualificação', '#A78BFA', 2, false, null),
    (new_org_id, 'Preparar abordagem', '#22D3EE', 3, false, null),
    (new_org_id, 'Contatado', '#60A5FA', 4, false, null),
    (new_org_id, 'Em conversa', '#FBBF24', 5, false, null),
    (new_org_id, 'Proposta enviada', '#C084FC', 6, false, null),
    (new_org_id, 'Negociação', '#FB923C', 7, false, null),
    (new_org_id, 'Ganho', '#34D399', 8, true, 'won'),
    (new_org_id, 'Perdido', '#FB7185', 9, true, 'lost');
  return new_org_id;
end;
$$;
revoke all on function public.create_organization_with_defaults(text, text) from public;
grant execute on function public.create_organization_with_defaults(text, text) to authenticated;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  stage_id uuid not null references public.pipeline_stages(id),
  assigned_to uuid references auth.users(id) on delete set null,
  priority public.lead_priority not null default 'medium',
  status public.lead_status not null default 'open',
  score integer check (score between 0 and 100),
  estimated_value numeric(12,2),
  probability numeric(5,2) check (probability between 0 and 100),
  service_interest text,
  next_contact_at timestamptz,
  loss_reason text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint leads_company_same_org_fk foreign key (organization_id, company_id)
    references public.companies(organization_id, id) deferrable initially deferred,
  constraint leads_stage_same_org_fk foreign key (organization_id, stage_id)
    references public.pipeline_stages(organization_id, id)
);
create unique index leads_one_active_company_idx on public.leads(organization_id, company_id)
  where archived_at is null;
create index leads_org_stage_updated_idx on public.leads(organization_id, stage_id, updated_at desc);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  position text,
  email text,
  phone text,
  preferred_channel text,
  created_at timestamptz not null default now(),
  constraint contacts_company_same_org_fk foreign key (organization_id, company_id)
    references public.companies(organization_id, id) on delete cascade
);
create index contacts_org_company_idx on public.contacts(organization_id, company_id);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  channel text,
  content_summary text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint interactions_lead_same_org_fk foreign key (organization_id, lead_id)
    references public.leads(organization_id, id) on delete cascade
);
create index interactions_lead_time_idx on public.interactions(organization_id, lead_id, occurred_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  status public.task_status not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tasks_lead_same_org_fk foreign key (organization_id, lead_id)
    references public.leads(organization_id, id) on delete cascade
);
create index tasks_org_status_due_idx on public.tasks(organization_id, status, due_at);

create table public.lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_stage_id uuid references public.pipeline_stages(id),
  to_stage_id uuid not null references public.pipeline_stages(id),
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  constraint stage_history_lead_same_org_fk foreign key (organization_id, lead_id)
    references public.leads(organization_id, id) on delete cascade,
  constraint stage_history_from_stage_same_org_fk foreign key (organization_id, from_stage_id)
    references public.pipeline_stages(organization_id, id),
  constraint stage_history_to_stage_same_org_fk foreign key (organization_id, to_stage_id)
    references public.pipeline_stages(organization_id, id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  base_price numeric(12,2),
  pricing_type text not null default 'fixed' check (pricing_type in ('fixed','hourly','custom','recurring')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id),
  proposal_number text not null,
  status text not null default 'draft',
  total_amount numeric(12,2) not null default 0,
  valid_until date,
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, proposal_number),
  constraint proposals_lead_same_org_fk foreign key (organization_id, lead_id)
    references public.leads(organization_id, id),
  unique (organization_id, id)
);

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  service_id uuid,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  constraint proposal_items_proposal_same_org_fk foreign key (organization_id, proposal_id)
    references public.proposals(organization_id, id) on delete cascade,
  constraint proposal_items_service_same_org_fk foreign key (organization_id, service_id)
    references public.services(organization_id, id) on delete restrict
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id),
  proposal_id uuid,
  title text not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'open' check (status in ('open','won','lost')),
  expected_close_at date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint deals_lead_same_org_fk foreign key (organization_id, lead_id)
    references public.leads(organization_id, id),
  constraint deals_proposal_same_org_fk foreign key (organization_id, proposal_id)
    references public.proposals(organization_id, id) on delete restrict
);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid,
  lead_id uuid,
  analysis_type text not null,
  result jsonb not null,
  score integer check (score between 0 and 100),
  confidence text,
  sources jsonb not null default '[]'::jsonb,
  model text not null,
  prompt_version text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint ai_analyses_company_same_org_fk foreign key (organization_id, company_id)
    references public.companies(organization_id, id) on delete restrict,
  constraint ai_analyses_lead_same_org_fk foreign key (organization_id, lead_id)
    references public.leads(organization_id, id) on delete restrict
);
create index ai_analyses_org_created_idx on public.ai_analyses(organization_id, created_at desc);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content text,
  tool_calls jsonb,
  created_at timestamptz not null default now(),
  constraint ai_messages_conversation_same_org_fk foreign key (organization_id, conversation_id)
    references public.ai_conversations(organization_id, id) on delete cascade
);

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  model text not null,
  operation text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost numeric(12,6) not null default 0,
  status text not null,
  created_at timestamptz not null default now()
);
create index ai_usage_org_time_idx on public.ai_usage_events(organization_id, created_at desc);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price numeric(12,2) not null,
  billing_interval text not null check (billing_interval in ('monthly','yearly')),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  provider text not null default 'asaas',
  external_customer_id text,
  external_checkout_id text,
  external_subscription_id text,
  status public.subscription_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_due_date date,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index subscriptions_one_current_per_org_idx on public.organization_subscriptions(organization_id)
  where status in ('incomplete','trialing','active','past_due','suspended');
create index subscriptions_org_status_idx on public.organization_subscriptions(organization_id, status);

create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null references public.organization_subscriptions(id),
  provider text not null default 'asaas',
  external_payment_id text not null,
  amount numeric(12,2) not null,
  status text not null,
  due_date date,
  paid_at timestamptz,
  invoice_url text,
  created_at timestamptz not null default now(),
  unique (provider, external_payment_id),
  constraint billing_payment_subscription_same_org_fk foreign key (organization_id, subscription_id)
    references public.organization_subscriptions(organization_id, id) on delete restrict
);

create table public.asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processing_status text not null default 'received' check (processing_status in ('received','processing','processed','failed','ignored')),
  attempts integer not null default 0,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null,
  limit_value bigint,
  period_start timestamptz,
  period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (organization_id, feature_key, period_start)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  status text not null default 'queued' check (status in ('queued','processing','succeeded','failed','dead_letter','canceled')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index jobs_ready_idx on public.jobs(run_after, created_at) where status = 'queued';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);

create or replace function public.can_edit_org(target_org uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select public.has_org_role(target_org, array['owner','admin','manager','member']::public.org_role[]);
$$;

create or replace function public.can_admin_org(target_org uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select public.has_org_role(target_org, array['owner','admin']::public.org_role[]);
$$;
revoke all on function public.can_edit_org(uuid) from public;
revoke all on function public.can_admin_org(uuid) from public;
grant execute on function public.can_edit_org(uuid) to authenticated;
grant execute on function public.can_admin_org(uuid) to authenticated;

-- Habilitar RLS e aplicar policies padrão a todas as tabelas tenant-scoped.
do $$
declare t text;
begin
  foreach t in array array[
    'companies','company_source_refs','searches','search_results','pipeline_stages',
    'leads','contacts','interactions','tasks','lead_stage_history','services',
    'proposals','proposal_items','deals','ai_analyses','ai_conversations',
    'ai_messages','ai_usage_events','organization_subscriptions','billing_payments',
    'entitlements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))', t || '_select_member', t);
    if t in ('organization_subscriptions','billing_payments','entitlements') then
      execute format('create policy %I on public.%I for insert to authenticated with check (public.can_admin_org(organization_id))', t || '_insert_admin', t);
      execute format('create policy %I on public.%I for update to authenticated using (public.can_admin_org(organization_id)) with check (public.can_admin_org(organization_id))', t || '_update_admin', t);
      execute format('create policy %I on public.%I for delete to authenticated using (public.can_admin_org(organization_id))', t || '_delete_admin', t);
    elsif t = 'ai_usage_events' then
      -- Eventos de consumo são gravados pelo backend; não dar escrita direta ao cliente.
      null;
    else
      execute format('create policy %I on public.%I for insert to authenticated with check (public.can_edit_org(organization_id))', t || '_insert_editor', t);
      execute format('create policy %I on public.%I for update to authenticated using (public.can_edit_org(organization_id)) with check (public.can_edit_org(organization_id))', t || '_update_editor', t);
      execute format('create policy %I on public.%I for delete to authenticated using (public.can_admin_org(organization_id))', t || '_delete_admin', t);
    end if;
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy profiles_select_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter table public.organizations enable row level security;
create policy organizations_select_member on public.organizations for select to authenticated using (public.is_org_member(id));
create policy organizations_update_admin on public.organizations for update to authenticated using (public.can_admin_org(id)) with check (public.can_admin_org(id));

alter table public.organization_members enable row level security;
create policy members_select_org on public.organization_members for select to authenticated using (public.is_org_member(organization_id));
create policy members_insert_admin on public.organization_members for insert to authenticated with check (public.can_admin_org(organization_id));
create policy members_update_admin on public.organization_members for update to authenticated using (public.can_admin_org(organization_id)) with check (public.can_admin_org(organization_id));
create policy members_delete_admin on public.organization_members for delete to authenticated using (public.can_admin_org(organization_id));

alter table public.plans enable row level security;
create policy plans_read_active on public.plans for select to authenticated using (is_active = true);

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = (select auth.uid()) and public.is_org_member(organization_id));
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = (select auth.uid()) and public.is_org_member(organization_id)) with check (user_id = (select auth.uid()) and public.is_org_member(organization_id));
-- Inserção de notificações feita pelo backend/worker.

alter table public.asaas_webhook_events enable row level security;
-- Sem policies para authenticated: acesso exclusivo via service role/worker server-side.

alter table public.jobs enable row level security;
create policy jobs_select_org_member on public.jobs for select to authenticated using (organization_id is not null and public.is_org_member(organization_id));
-- Criação/claim/atualização de jobs deve ocorrer via função controlada no servidor.

alter table public.audit_logs enable row level security;
create policy audit_logs_select_admin on public.audit_logs for select to authenticated using (organization_id is not null and public.can_admin_org(organization_id));
-- Escrita de audit_logs feita pelo backend com service role ou RPC controlada; clientes não recebem policy de escrita.

-- Observações para a próxima migration:
-- 1. Implementar trigger updated_at nas tabelas mutáveis.
-- 2. Criar função segura de onboarding transacional (organization + membership + stages iniciais).
-- 3. Validar FKs tenant-scoped para proposals/services/deals e eventos relacionados.
-- 4. Refinar roles por tabela (viewer read-only; member sem gestão de billing/membros).
-- 5. Adicionar policies de escopo de membership e storage buckets privados.
-- 6. Criar testes de RLS com tenants distintos. Não enviar esta migration à produção sem revisão.


create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','organizations','companies','leads','services','proposals','ai_conversations','organization_subscriptions'] loop
    execute format('create trigger %I before update on public.%I for each row execute procedure public.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;
