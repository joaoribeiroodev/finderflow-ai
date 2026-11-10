-- Evolução (2026-11-09) — endurecimento de performance e segurança
-- derivado dos advisors do Supabase (ver docs/DECISIONS.md, "Evolução
-- 2026-11-09").

-- ===========================================================================
-- 1. check_rate_limit não deve ser chamável por anon/authenticated
-- ===========================================================================
-- A função é SECURITY DEFINER e só é usada pelo servidor via service_role
-- (src/lib/security/distributed-rate-limit.ts). Exposta em
-- /rest/v1/rpc/check_rate_limit para qualquer visitante, ela permitia a um
-- anônimo incrementar contadores arbitrários — inclusive os de login de
-- outra pessoa, forçando um bloqueio temporário (negação de serviço
-- direcionada).
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- ===========================================================================
-- 2. Políticas permissivas duplicadas → uma política por (tabela, ação)
-- ===========================================================================
-- Duas políticas permissivas para o mesmo papel/ação são avaliadas as duas
-- em toda consulta. Mesma semântica (OR), uma única política.
drop policy if exists organizations_select_member on public.organizations;
drop policy if exists organizations_select_super_admin on public.organizations;
create policy organizations_select_visible on public.organizations
  for select to authenticated
  using (public.is_org_member(id) or (select public.is_platform_super_admin()));

drop policy if exists organizations_update_admin on public.organizations;
drop policy if exists organizations_update_super_admin on public.organizations;
create policy organizations_update_allowed on public.organizations
  for update to authenticated
  using (public.can_admin_org(id) or (select public.is_platform_super_admin()))
  with check (public.can_admin_org(id) or (select public.is_platform_super_admin()));

drop policy if exists members_select_org on public.organization_members;
drop policy if exists members_select_super_admin on public.organization_members;
create policy members_select_visible on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id) or (select public.is_platform_super_admin()));

drop policy if exists profiles_select_visible on public.profiles;
drop policy if exists profiles_select_super_admin on public.profiles;
create policy profiles_select_visible on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.shares_org_with(id)
    or (select public.is_platform_super_admin())
  );

-- ===========================================================================
-- 3. Índices de cobertura para chaves estrangeiras
-- ===========================================================================
-- Sem índice no lado filho, todo DELETE/UPDATE no pai (ex.: excluir uma
-- organização, um lead, uma campanha) faz varredura sequencial na tabela
-- filha. Índices só em (organization_id) foram omitidos quando um índice
-- composto (organization_id, x) criado aqui já cobre o prefixo.
create index if not exists ai_analyses_organization_id_company_id_fkidx on public.ai_analyses (organization_id, company_id);
create index if not exists ai_analyses_organization_id_lead_id_fkidx on public.ai_analyses (organization_id, lead_id);
create index if not exists ai_usage_events_user_id_fkidx on public.ai_usage_events (user_id);
create index if not exists billing_payments_organization_id_subscription_id_fkidx on public.billing_payments (organization_id, subscription_id);
create index if not exists cadence_enrollments_lead_id_fkidx on public.cadence_enrollments (lead_id);
create index if not exists cadence_enrollments_organization_id_cadence_id_fkidx on public.cadence_enrollments (organization_id, cadence_id);
create index if not exists cadence_step_sends_organization_id_enrollment_id_fkidx on public.cadence_step_sends (organization_id, enrollment_id);
create index if not exists cadence_step_sends_step_id_fkidx on public.cadence_step_sends (step_id);
create index if not exists cadence_steps_organization_id_cadence_id_fkidx on public.cadence_steps (organization_id, cadence_id);
create index if not exists cadences_created_by_fkidx on public.cadences (created_by);
create index if not exists campaign_companies_added_by_fkidx on public.campaign_companies (added_by);
create index if not exists campaign_companies_company_id_fkidx on public.campaign_companies (company_id);
create index if not exists campaign_companies_organization_id_campaign_id_fkidx on public.campaign_companies (organization_id, campaign_id);
create index if not exists campaign_messages_approved_by_fkidx on public.campaign_messages (approved_by);
create index if not exists campaign_messages_created_by_fkidx on public.campaign_messages (created_by);
create index if not exists campaign_messages_organization_id_campaign_company_id_fkidx on public.campaign_messages (organization_id, campaign_company_id);
create index if not exists campaign_messages_organization_id_campaign_id_fkidx on public.campaign_messages (organization_id, campaign_id);
create index if not exists campaigns_created_by_fkidx on public.campaigns (created_by);
create index if not exists company_enrichment_fields_organization_id_company_id_fkidx on public.company_enrichment_fields (organization_id, company_id);
create index if not exists company_enrichment_fields_reviewed_by_fkidx on public.company_enrichment_fields (reviewed_by);
create index if not exists company_source_refs_organization_id_company_id_fkidx on public.company_source_refs (organization_id, company_id);
create index if not exists contract_asaas_customers_company_id_fkidx on public.contract_asaas_customers (company_id);
create index if not exists contract_charges_company_id_fkidx on public.contract_charges (company_id);
create index if not exists contract_charges_created_by_fkidx on public.contract_charges (created_by);
create index if not exists deals_organization_id_lead_id_fkidx on public.deals (organization_id, lead_id);
create index if not exists digital_presence_scores_organization_id_company_id_fkidx on public.digital_presence_scores (organization_id, company_id);
create index if not exists lead_scores_organization_id_lead_id_fkidx on public.lead_scores (organization_id, lead_id);
create index if not exists lead_stage_history_changed_by_fkidx on public.lead_stage_history (changed_by);
create index if not exists lead_stage_history_organization_id_from_stage_id_fkidx on public.lead_stage_history (organization_id, from_stage_id);
create index if not exists lead_stage_history_organization_id_lead_id_fkidx on public.lead_stage_history (organization_id, lead_id);
create index if not exists lead_stage_history_organization_id_to_stage_id_fkidx on public.lead_stage_history (organization_id, to_stage_id);
create index if not exists notifications_user_id_fkidx on public.notifications (user_id);
create index if not exists organization_integration_credentials_asaas_secret_id_fkidx on public.organization_integration_credentials (asaas_secret_id);
create index if not exists organization_integration_credentials_gmail_secret_id_fkidx on public.organization_integration_credentials (gmail_secret_id);
create index if not exists organization_integration_credentials_openai_secret_id_fkidx on public.organization_integration_credentials (openai_secret_id);
create index if not exists organization_integration_credentials_pagespeed_secret_id_fkidx on public.organization_integration_credentials (pagespeed_secret_id);
create index if not exists organizations_approval_reviewed_by_fkidx on public.organizations (approval_reviewed_by);
create index if not exists outreach_emails_organization_id_company_id_fkidx on public.outreach_emails (organization_id, company_id);
create index if not exists outreach_emails_sent_by_fkidx on public.outreach_emails (sent_by);
create index if not exists outreach_emails_source_analysis_id_fkidx on public.outreach_emails (source_analysis_id);
create index if not exists proposal_items_organization_id_proposal_id_fkidx on public.proposal_items (organization_id, proposal_id);
create index if not exists proposal_items_organization_id_service_id_fkidx on public.proposal_items (organization_id, service_id);
create index if not exists proposals_organization_id_lead_id_fkidx on public.proposals (organization_id, lead_id);
create index if not exists search_results_organization_id_company_id_fkidx on public.search_results (organization_id, company_id);
create index if not exists suppression_entries_created_by_fkidx on public.suppression_entries (created_by);
create index if not exists tasks_organization_id_lead_id_fkidx on public.tasks (organization_id, lead_id);
create index if not exists website_audits_organization_id_company_id_fkidx on public.website_audits (organization_id, company_id);

-- ===========================================================================
-- 4. Cache de respostas de provedores de dados públicos (busca de empresas)
-- ===========================================================================
-- Guarda respostas já obtidas do provedor de CNPJ (dado público da Receita
-- Federal, não é dado de tenant) para (a) não repetir a mesma consulta ao
-- provedor gratuito e esbarrar no limite de taxa dele (429) e (b) ainda
-- conseguir responder com o último resultado conhecido quando o provedor
-- estiver fora do ar. Só o servidor (service_role) lê/grava: RLS ligada
-- sem nenhuma política para anon/authenticated.
create table if not exists public.provider_response_cache (
  cache_key text primary key,
  provider text not null,
  kind text not null check (kind in ('search', 'cnpj')),
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
create index if not exists provider_response_cache_fetched_at_idx on public.provider_response_cache (fetched_at);
alter table public.provider_response_cache enable row level security;
revoke all on public.provider_response_cache from anon, authenticated;
