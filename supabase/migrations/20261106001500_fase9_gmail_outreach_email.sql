-- Fase 9: envio real de e-mail de prospecção (a geração do rascunho via
-- IA já existia — outreach_generator.service.ts/ai_analyses — faltava o
-- envio de fato). Cada organização conecta sua PRÓPRIA conta Gmail
-- (endereço + senha de app), para o e-mail sair com o remetente real do
-- usuário (mais credibilidade, menos risco de spam) em vez de um domínio
-- transacional genérico. Senha de app guardada no Vault, mesmo padrão de
-- asaas_secret_id/openai_secret_id.

alter table public.organization_integration_credentials
  add column if not exists gmail_email text,
  add column if not exists gmail_secret_id uuid references vault.secrets(id) on delete set null,
  add column if not exists gmail_configured_at timestamptz;

create or replace function public.set_org_gmail_credentials(p_org uuid, p_email text, p_app_password text)
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
  if length(trim(coalesce(p_email, ''))) = 0 then
    raise exception 'empty email' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_app_password, ''))) = 0 then
    raise exception 'empty app password' using errcode = '22023';
  end if;

  select gmail_secret_id into v_secret_id
  from public.organization_integration_credentials
  where organization_id = p_org;

  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_app_password);
  else
    v_secret_id := vault.create_secret(p_app_password, 'gmail_app_password:' || p_org::text);
  end if;

  insert into public.organization_integration_credentials (organization_id, gmail_email, gmail_secret_id, gmail_configured_at, updated_at)
  values (p_org, p_email, v_secret_id, now(), now())
  on conflict (organization_id) do update
    set gmail_email = excluded.gmail_email,
        gmail_secret_id = excluded.gmail_secret_id,
        gmail_configured_at = now(),
        updated_at = now();
end;
$$;
revoke all on function public.set_org_gmail_credentials(uuid, text, text) from public;
revoke execute on function public.set_org_gmail_credentials(uuid, text, text) from anon;
grant execute on function public.set_org_gmail_credentials(uuid, text, text) to authenticated;

create or replace function public.clear_org_gmail_credentials(p_org uuid)
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

  select gmail_secret_id into v_secret_id
  from public.organization_integration_credentials
  where organization_id = p_org;

  update public.organization_integration_credentials
  set gmail_email = null, gmail_secret_id = null, gmail_configured_at = null, updated_at = now()
  where organization_id = p_org;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
end;
$$;
revoke all on function public.clear_org_gmail_credentials(uuid) from public;
revoke execute on function public.clear_org_gmail_credentials(uuid) from anon;
grant execute on function public.clear_org_gmail_credentials(uuid) to authenticated;

-- Leitura em texto puro: exclusivo do backend (service role), no momento
-- de efetivamente conectar ao SMTP do Gmail em nome da organização.
create or replace function public.get_org_gmail_app_password(p_org uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_password text;
begin
  select ds.decrypted_secret into v_password
  from vault.decrypted_secrets ds
  join public.organization_integration_credentials c on c.gmail_secret_id = ds.id
  where c.organization_id = p_org;
  return v_password;
end;
$$;
revoke all on function public.get_org_gmail_app_password(uuid) from public;
revoke all on function public.get_org_gmail_app_password(uuid) from authenticated;
revoke execute on function public.get_org_gmail_app_password(uuid) from anon;
grant execute on function public.get_org_gmail_app_password(uuid) to service_role;

-- Registro dos e-mails de prospecção efetivamente enviados (não dos
-- rascunhos gerados pela IA — esses continuam em ai_analyses). Cada
-- envio vincula a um lead; o rascunho de origem (quando veio da IA) é
-- referenciado por source_analysis_id, sem obrigatoriedade (o usuário
-- pode editar livremente antes de enviar).
create table public.outreach_emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null,
  company_id uuid not null,
  source_analysis_id uuid references public.ai_analyses(id) on delete set null,
  recipient_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error_message text,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint outreach_emails_lead_same_org_fk foreign key (organization_id, lead_id)
    references public.leads(organization_id, id) on delete cascade,
  constraint outreach_emails_company_same_org_fk foreign key (organization_id, company_id)
    references public.companies(organization_id, id) on delete cascade
);
create index outreach_emails_org_lead_idx on public.outreach_emails(organization_id, lead_id, created_at desc);

alter table public.outreach_emails enable row level security;
create policy outreach_emails_select_member on public.outreach_emails
  for select to authenticated using (public.is_org_member(organization_id));
create policy outreach_emails_insert_editor on public.outreach_emails
  for insert to authenticated with check (public.can_edit_org(organization_id));
