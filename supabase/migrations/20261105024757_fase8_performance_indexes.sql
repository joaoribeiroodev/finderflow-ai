-- Fase 8 (hardening): índices para colunas de filtro/FK sem cobertura,
-- identificadas pelo advisor de performance. Cobre apenas os casos com
-- padrão de consulta real na aplicação (filtro por organização, por
-- usuário responsável/ator, ou join direto) — FKs compostas "_same_org_fk"
-- (usadas só como checagem de integridade referencial, nunca como chave de
-- busca) foram deliberadamente deixadas de fora; ver docs/DECISIONS.md.

create index if not exists notifications_org_user_idx
  on public.notifications (organization_id, user_id);

create index if not exists ai_messages_org_conversation_idx
  on public.ai_messages (organization_id, conversation_id);

create index if not exists leads_assigned_to_idx
  on public.leads (assigned_to);

create index if not exists tasks_assigned_to_idx
  on public.tasks (assigned_to);

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

create index if not exists ai_conversations_user_id_idx
  on public.ai_conversations (user_id);

create index if not exists audit_logs_actor_id_idx
  on public.audit_logs (actor_id);

create index if not exists interactions_actor_id_idx
  on public.interactions (actor_id);

create index if not exists searches_created_by_idx
  on public.searches (created_by);

create index if not exists import_jobs_created_by_idx
  on public.import_jobs (created_by);

create index if not exists ai_analyses_created_by_idx
  on public.ai_analyses (created_by);

create index if not exists lead_stage_history_org_changed_by_idx
  on public.lead_stage_history (organization_id, changed_by);

create index if not exists organization_subscriptions_plan_id_idx
  on public.organization_subscriptions (plan_id);

create index if not exists proposal_items_proposal_id_idx
  on public.proposal_items (proposal_id);

create index if not exists proposal_items_organization_id_idx
  on public.proposal_items (organization_id);

create index if not exists jobs_organization_id_idx
  on public.jobs (organization_id);

create index if not exists company_source_refs_organization_id_idx
  on public.company_source_refs (organization_id);

create index if not exists billing_payments_organization_id_idx
  on public.billing_payments (organization_id);
