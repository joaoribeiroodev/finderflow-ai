-- Atualiza preço e limite mensal de chamadas de IA dos dois planos
-- existentes (seed original em `20261104172247_create_billing_support.sql`,
-- já aplicada ao remoto e ao local — nunca reescrever uma migration já
-- aplicada, mesma regra seguida em `fix_count_ai_usage_in_period_signature`).
-- Nova decisão de negócio do usuário (2026-11-05, ver docs/DECISIONS.md):
--
--   Starter: R$ 19,99/mês, 50 chamadas de IA/mês (era R$ 97,00 / 100)
--   Pro:     R$ 47,99/mês, 300 chamadas de IA/mês (era R$ 247,00 / 500)
--
-- `update ... where slug = ...` em vez de recriar as linhas: preserva o
-- `id` de cada plano, que já pode estar referenciado por
-- `organization_subscriptions.plan_id` em assinaturas existentes.
update public.plans
set price = 19.99,
    limits = jsonb_set(limits, '{ai_monthly_requests}', '50')
where slug = 'starter';

update public.plans
set price = 47.99,
    limits = jsonb_set(limits, '{ai_monthly_requests}', '300')
where slug = 'pro';
