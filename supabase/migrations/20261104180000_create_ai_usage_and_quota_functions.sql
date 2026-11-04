-- Fase 5 (IA/OpenAI) — suporte a quotas e telemetria de uso de IA.
--
-- `ai_usage_events` (Fase 0/1) já guarda model/operation/input_tokens/
-- output_tokens/estimated_cost/status, mas falta duração e versão do
-- prompt — o prompt mestre (docs/05-integrations.md §5.1) exige registrar
-- "modelo, versão do prompt, tokens de entrada/saída, custo estimado,
-- duração e status" para toda chamada de IA.
--
-- `ai_usage_events` não tem policy de insert para `authenticated` (de
-- propósito — ver comentário na migration original: "gravado pelo
-- backend"). Em vez de usar a service_role key no caminho de requisição
-- normal (o que apagaria o `auth.uid()` dos logs/RLS), expomos uma RPC
-- security definer que insere em nome do usuário autenticado, após
-- confirmar que ele é membro da organização — o mesmo padrão já usado
-- em `move_lead_stage`/`reorder_pipeline_stages` (Fase 4).
--
-- Quota: `entitlements` (Fase 0/1) só pode ser escrita por admins da
-- organização via RLS. Como qualquer membro pode disparar uma chamada de
-- IA (não só admins), a verificação/criação lazy do registro mensal de
-- quota também precisa de uma RPC security definer. O limite padrão
-- (`p_default_limit`) é um placeholder documentado em DECISIONS.md —
-- não existe ainda um plano real (Fase 6/Asaas) que defina limites por
-- plano contratado.

alter table public.ai_usage_events
  add column if not exists prompt_version text,
  add column if not exists duration_ms integer;

create or replace function public.get_or_create_ai_quota(
  p_organization_id uuid,
  p_feature_key text,
  p_default_limit bigint
)
returns public.entitlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end timestamptz := date_trunc('month', now()) + interval '1 month';
  v_row public.entitlements;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not_org_member' using errcode = '42501';
  end if;

  select * into v_row
  from public.entitlements
  where organization_id = p_organization_id
    and feature_key = p_feature_key
    and period_start = v_period_start;

  if found then
    return v_row;
  end if;

  insert into public.entitlements (organization_id, feature_key, limit_value, period_start, period_end, metadata)
  values (p_organization_id, p_feature_key, p_default_limit, v_period_start, v_period_end, jsonb_build_object('source', 'placeholder_default'))
  on conflict (organization_id, feature_key, period_start) do nothing
  returning * into v_row;

  if v_row.id is null then
    -- Corrida: outra sessão inseriu entre o select e o insert. Lê de novo.
    select * into v_row
    from public.entitlements
    where organization_id = p_organization_id
      and feature_key = p_feature_key
      and period_start = v_period_start;
  end if;

  return v_row;
end;
$$;

revoke all on function public.get_or_create_ai_quota(uuid, text, bigint) from public;
revoke all on function public.get_or_create_ai_quota(uuid, text, bigint) from anon;
grant execute on function public.get_or_create_ai_quota(uuid, text, bigint) to authenticated;

create or replace function public.count_ai_usage_in_period(
  p_organization_id uuid,
  p_feature_key text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.ai_usage_events
  where organization_id = p_organization_id
    and operation = p_feature_key
    and created_at >= p_period_start
    and created_at < p_period_end
    and status in ('completed', 'incomplete');
$$;

revoke all on function public.count_ai_usage_in_period(uuid, text, timestamptz, timestamptz) from public;
revoke all on function public.count_ai_usage_in_period(uuid, text, timestamptz, timestamptz) from anon;
grant execute on function public.count_ai_usage_in_period(uuid, text, timestamptz, timestamptz) to authenticated;

create or replace function public.log_ai_usage(
  p_organization_id uuid,
  p_model text,
  p_operation text,
  p_prompt_version text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost numeric,
  p_duration_ms integer,
  p_status text
)
returns public.ai_usage_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.ai_usage_events;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not_org_member' using errcode = '42501';
  end if;

  insert into public.ai_usage_events (
    organization_id, user_id, model, operation, prompt_version,
    input_tokens, output_tokens, estimated_cost, duration_ms, status
  ) values (
    p_organization_id, auth.uid(), p_model, p_operation, p_prompt_version,
    coalesce(p_input_tokens, 0), coalesce(p_output_tokens, 0), coalesce(p_estimated_cost, 0),
    p_duration_ms, p_status
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.log_ai_usage(uuid, text, text, text, integer, integer, numeric, integer, text) from public;
revoke all on function public.log_ai_usage(uuid, text, text, text, integer, integer, numeric, integer, text) from anon;
grant execute on function public.log_ai_usage(uuid, text, text, text, integer, integer, numeric, integer, text) to authenticated;
