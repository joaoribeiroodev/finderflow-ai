-- Correção: a quota mensal de IA é um agregado de TODAS as operações de
-- IA da organização (company_analyzer, lead_scorer, outreach_generator,
-- copilot, ...), não de uma única "feature_key" literal igual ao valor
-- gravado em `operation` — esses dois conceitos são campos diferentes
-- (feature_key da quota vs. operation de cada chamada). A versão anterior
-- desta função (20261104180000) filtrava por `operation = p_feature_key`,
-- o que nunca bateria com o `operation` real gravado por `log_ai_usage`
-- (ex.: "company_analyzer"). Trocando a assinatura para contar tudo no
-- período, sem filtrar por operação.

drop function if exists public.count_ai_usage_in_period(uuid, text, timestamptz, timestamptz);

create or replace function public.count_ai_usage_in_period(
  p_organization_id uuid,
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
    and created_at >= p_period_start
    and created_at < p_period_end
    and status in ('completed', 'incomplete');
$$;

revoke all on function public.count_ai_usage_in_period(uuid, timestamptz, timestamptz) from public;
revoke all on function public.count_ai_usage_in_period(uuid, timestamptz, timestamptz) from anon;
grant execute on function public.count_ai_usage_in_period(uuid, timestamptz, timestamptz) to authenticated;
