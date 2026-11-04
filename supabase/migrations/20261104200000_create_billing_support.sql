-- Fase 6 (Asaas billing) — suporte de dados para checkout recorrente,
-- webhook idempotente e planos reais (docs/05-integrations.md §5.2,
-- docs/07-backlog-and-acceptance.md EPIC 07).
--
-- `plans`/`organization_subscriptions`/`billing_payments`/
-- `asaas_webhook_events`/`entitlements` já existem desde a Fase 0/1
-- (docs/03-database.md) com RLS aplicada (ver migration
-- 20261104000000_core_schema.sql) — esta migration só acrescenta o que
-- faltava: dados de faturamento da organização (exigidos pela API do
-- Asaas para criar um customer — `name`+`cpfCnpj` obrigatórios, conferido
-- em docs.asaas.com/reference/create-new-customer durante a
-- implementação), o catálogo inicial de planos, e uma função para
-- reivindicar eventos de webhook atomicamente (idempotência real, não
-- apenas "não duplicar a linha").

-- 1. Dados de faturamento da organização (nunca de cartão — apenas o que
-- o Asaas exige para o cadastro de customer). Nullable: só são exigidos
-- no momento do checkout, validados na Server Action, não aqui.
alter table public.organizations
  add column if not exists billing_name text,
  add column if not exists billing_document text,
  add column if not exists billing_email text;

-- 2. Catálogo inicial de planos. Preços e limites são placeholders de
-- negócio (mesma natureza do DEFAULT_MONTHLY_AI_LIMIT da Fase 5) — ainda
-- não existe uma decisão comercial formal; documentado como divergência
-- em docs/DECISIONS.md. `limits.ai_monthly_requests` é o único limite
-- hoje aplicado (pela Fase 5), mas o formato é extensível.
insert into public.plans (slug, name, description, price, billing_interval, limits, features, is_active)
values
  (
    'starter',
    'Starter',
    'Prospecção e CRM com IA para equipes pequenas.',
    97.00,
    'monthly',
    jsonb_build_object('ai_monthly_requests', 100),
    jsonb_build_object('copilot', true, 'company_analyzer', true, 'lead_scorer', true, 'outreach_generator', true),
    true
  ),
  (
    'pro',
    'Pro',
    'Mais volume de IA e prioridade de suporte.',
    247.00,
    'monthly',
    jsonb_build_object('ai_monthly_requests', 500),
    jsonb_build_object('copilot', true, 'company_analyzer', true, 'lead_scorer', true, 'outreach_generator', true, 'priority_support', true),
    true
  )
on conflict (slug) do nothing;

-- 3. Reivindicação atômica de evento de webhook.
--
-- O endpoint do webhook (`/api/v1/webhooks/asaas`) não tem sessão de
-- usuário e grava com o cliente admin (service role). Entrega é "at
-- least once" (confirmado em docs.asaas.com/docs/receba-eventos-do-asaas
-- durante a implementação) — um evento pode chegar mais de uma vez, e um
-- retry de um evento que falhou no meio do processamento deve ser
-- reprocessado, não descartado como duplicata.
--
-- `insert ... on conflict (provider_event_id) do update ... where
-- processing_status in ('received','failed')` faz isso em uma única
-- operação atômica: evento novo -> insere; evento já visto mas não
-- concluído -> reivindica de novo (attempts+1); evento já concluído
-- (`processed`/`ignored`) -> a cláusula WHERE não bate, nada é
-- atualizado, e devolvemos claimed=false para o handler responder 200
-- sem reprocessar. Sem isso, duas chamadas concorrentes (ou um retry
-- durante o processamento) poderiam aplicar o mesmo pagamento duas vezes.
create or replace function public.claim_asaas_webhook_event(
  p_provider_event_id text,
  p_event_type text,
  p_payload jsonb
)
returns table (claimed boolean, event_id uuid, attempts integer, processing_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.asaas_webhook_events;
begin
  insert into public.asaas_webhook_events (provider_event_id, event_type, payload, processing_status, attempts, received_at)
  values (p_provider_event_id, p_event_type, p_payload, 'processing', 1, now())
  on conflict (provider_event_id) do update
    set attempts = public.asaas_webhook_events.attempts + 1,
        payload = excluded.payload,
        event_type = excluded.event_type,
        processing_status = 'processing'
    where public.asaas_webhook_events.processing_status in ('received', 'failed')
  returning * into v_row;

  if v_row.id is not null then
    return query select true, v_row.id, v_row.attempts, v_row.processing_status;
    return;
  end if;

  -- Não reivindicado (já processado/ignorado antes): devolve o estado atual.
  select * into v_row from public.asaas_webhook_events where provider_event_id = p_provider_event_id;
  return query select false, v_row.id, v_row.attempts, v_row.processing_status;
end;
$$;

-- Função de uso exclusivo do pipeline de webhook server-side (service
-- role) — nunca deve ser chamável por um usuário autenticado comum, já
-- que não recebe nem valida organization_id.
revoke all on function public.claim_asaas_webhook_event(text, text, jsonb) from public;
revoke all on function public.claim_asaas_webhook_event(text, text, jsonb) from anon;
revoke all on function public.claim_asaas_webhook_event(text, text, jsonb) from authenticated;
grant execute on function public.claim_asaas_webhook_event(text, text, jsonb) to service_role;
