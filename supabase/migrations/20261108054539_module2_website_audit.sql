-- Módulo 2 — Website Audit (PageSpeed Insights).
--
-- Decisão de negócio (ver ETAPA-0-AUDITORIA.md seção 6: "precisa de chave
-- de API do Google Cloud... requer projeto GCP e possivelmente billing
-- habilitado"): sob a premissa explícita do usuário de só usar integrações
-- gratuitas ou open source, confirmamos que a Google PageSpeed Insights
-- API tem cota gratuita generosa (25.000 requisições/dia por chave) e NÃO
-- exige conta de faturamento habilitada para esse uso — só uma chave de
-- API de um projeto Google Cloud (gratuito). Isso resolve o bloqueio sem
-- precisar perguntar de novo: cada organização cria sua própria chave
-- gratuita, exatamente como já faz hoje com Gmail/OpenAI/Asaas.
--
-- Mesmo padrão de credencial por organização via Supabase Vault (Fase 9)
-- usado para Asaas/OpenAI/Gmail — ver 20261105224500_fase9_approval_security_org_credentials.sql.

alter table public.organization_integration_credentials
  add column if not exists pagespeed_secret_id uuid references vault.secrets(id) on delete set null,
  add column if not exists pagespeed_configured_at timestamptz;

create or replace function public.set_org_pagespeed_credentials(p_org uuid, p_api_key text)
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

  select pagespeed_secret_id into v_secret_id
  from public.organization_integration_credentials
  where organization_id = p_org;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_api_key);
  else
    v_secret_id := vault.create_secret(p_api_key, 'pagespeed_api_key:' || p_org::text);
  end if;

  insert into public.organization_integration_credentials (organization_id, pagespeed_secret_id, pagespeed_configured_at, updated_at)
  values (p_org, v_secret_id, now(), now())
  on conflict (organization_id) do update
    set pagespeed_secret_id = excluded.pagespeed_secret_id,
        pagespeed_configured_at = now(),
        updated_at = now();
end;
$$;
revoke all on function public.set_org_pagespeed_credentials(uuid, text) from public, anon;
grant execute on function public.set_org_pagespeed_credentials(uuid, text) to authenticated;

create or replace function public.clear_org_pagespeed_credentials(p_org uuid)
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

  select pagespeed_secret_id into v_secret_id
  from public.organization_integration_credentials
  where organization_id = p_org;

  update public.organization_integration_credentials
  set pagespeed_secret_id = null, pagespeed_configured_at = null, updated_at = now()
  where organization_id = p_org;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;
revoke all on function public.clear_org_pagespeed_credentials(uuid) from public, anon;
grant execute on function public.clear_org_pagespeed_credentials(uuid) to authenticated;

create or replace function public.get_org_pagespeed_api_key(p_org uuid)
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
  join public.organization_integration_credentials c on c.pagespeed_secret_id = ds.id
  where c.organization_id = p_org;
  return v_key;
end;
$$;
revoke all on function public.get_org_pagespeed_api_key(uuid) from public, anon;
revoke all on function public.get_org_pagespeed_api_key(uuid) from authenticated;
grant execute on function public.get_org_pagespeed_api_key(uuid) to service_role;

-- Histórico de auditorias (nunca sobrescreve — mesmo princípio de
-- `digital_presence_scores`): cada execução grava uma nova linha, mesmo
-- quando falha (status 'failed' + error_message), para o histórico
-- mostrar tentativas e não só sucessos.
create table public.website_audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  url text not null,
  strategy text not null default 'mobile' check (strategy in ('mobile', 'desktop')),
  status text not null default 'completed' check (status in ('completed', 'failed')),
  performance_score smallint check (performance_score is null or (performance_score >= 0 and performance_score <= 100)),
  accessibility_score smallint check (accessibility_score is null or (accessibility_score >= 0 and accessibility_score <= 100)),
  best_practices_score smallint check (best_practices_score is null or (best_practices_score >= 0 and best_practices_score <= 100)),
  seo_score smallint check (seo_score is null or (seo_score >= 0 and seo_score <= 100)),
  largest_contentful_paint_ms integer,
  cumulative_layout_shift numeric,
  total_blocking_time_ms integer,
  issues jsonb not null default '[]'::jsonb,
  error_message text,
  provider text not null default 'pagespeed',
  run_at timestamptz not null default now(),
  constraint website_audits_company_same_org_fk foreign key (organization_id, company_id)
    references public.companies(organization_id, id) on delete cascade
);
create index website_audits_company_latest_idx on public.website_audits(company_id, run_at desc);

alter table public.website_audits enable row level security;

create policy website_audits_select_member on public.website_audits
  for select to authenticated using (public.is_org_member(organization_id));

-- Append-only (histórico de auditoria) — sem policy de update/delete,
-- mesmo princípio de `digital_presence_scores`.
create policy website_audits_insert_editor on public.website_audits
  for insert to authenticated with check (public.can_edit_org(organization_id));
