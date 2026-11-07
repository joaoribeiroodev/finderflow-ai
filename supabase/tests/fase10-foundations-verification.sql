-- Verificação ao vivo da Fase 10 (fundações) — rodada em partes via
-- mcp__Supabase__execute_sql contra o projeto real (lxzsefabmnagiaywaxeb)
-- em 2026-11-07, mesmo princípio de supabase/tests/rls-cross-tenant-verification.sql
-- (SET ROLE + request.jwt.claims simulam exatamente o que o PostgREST faz
-- a partir de um JWT real).
--
-- Resultado: todos os testes PASS, incluindo um bug real encontrado e
-- corrigido no processo — ver migration
-- 20261107201500_fase10_fix_check_rate_limit_ambiguous_column.sql
-- (`check_rate_limit` tinha uma coluna de OUT parameter colidindo com a
-- coluna da tabela dentro do próprio UPDATE; só apareceu ao executar de
-- verdade, não no typecheck/lint/testes unitários).
--
-- Testes cobertos:
-- 1. suppression_entries: insert na própria organização funciona.
-- 2. suppression_entries: insert cross-tenant é bloqueado pela RLS
--    policy; select cross-tenant retorna 0 linhas.
-- 3. is_contact_suppressed(): normaliza e-mail (case/espaços) e isola
--    por organização (mesmo contato suprimido na org A não aparece
--    suprimido ao checar contra a org B — por design: cada organização
--    é um controlador de dados separado).
-- 4. check_rate_limit(): callable por `anon`, permite até o limite e
--    bloqueia a chamada seguinte, dentro da mesma janela.
-- 5. claim_next_job(): bloqueado tanto para `authenticated` quanto para
--    `anon` — só service_role (worker) pode chamar.
-- 6. Ciclo de vida completo de um job real: enqueue → claim (status
--    muda para processing, attempts incrementa, locked_by é setado) →
--    uma segunda tentativa de claim não encontra nada (já não está
--    `queued`).
--
-- Diferente do script de Fase 1, esta verificação NÃO terminou com um
-- commit/cleanup automático dentro da própria transação: o ambiente que
-- rodou esta sessão não conseguiu confirmar as chamadas destrutivas de
-- limpeza (timeout/cancelamento da confirmação da ferramenta MCP, não um
-- problema do banco ou das policies). Os ids de teste abaixo ficaram
-- registrados para limpeza manual (dashboard do Supabase ou uma sessão
-- com a confirmação funcionando):
--
--   delete from public.suppression_entries where organization_id in
--     ('6b9ee4c4-93d1-4bca-9239-045d78e37488', 'ea123eb6-52fb-4da4-9ea2-fa0350506e74');
--   delete from public.organizations where id in
--     ('6b9ee4c4-93d1-4bca-9239-045d78e37488', 'ea123eb6-52fb-4da4-9ea2-fa0350506e74');
--   delete from auth.users where id in
--     ('e2c7e21c-977a-4691-8a1e-ca43cd241e4c', '85e98381-80d0-4c8a-ab4f-4eaa55dd5bd5');
--   delete from public.jobs where id = 'dc2dcaa7-e206-4196-8dbb-f106319e46e0';
--   delete from public.rate_limit_counters where key = 'fase10-rl-test-key';
--
-- Nenhum desses ids tem qualquer relação com dados reais de usuários —
-- são 2 organizações, 2 usuários, 1 job e 2 linhas criadas inteiramente
-- por este script, com e-mails `fase10-test-*@example.test`.

-- Passo 1 — dois usuários + duas organizações de teste.
begin;
create temporary table test_ids (key text primary key, value text);
grant select, insert, update, delete on test_ids to authenticated, anon, service_role;

with new_user as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, is_sso_user, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'fase10-test-a@example.test', 'x', now(), '{}', '{}', now(), now(), '', '', '', '', false, false)
  returning id
)
insert into test_ids(key, value) select 'user_a', id::text from new_user;

with new_user as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, is_sso_user, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'fase10-test-b@example.test', 'x', now(), '{}', '{}', now(), now(), '', '', '', '', false, false)
  returning id
)
insert into test_ids(key, value) select 'user_b', id::text from new_user;

do $$
declare uid text;
begin
  select value into uid from test_ids where key = 'user_a';
  execute 'set role authenticated';
  execute format('set request.jwt.claims to %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;
insert into test_ids(key, value)
select 'org_a', create_organization_with_defaults('Org A Fase10', 'org-a-fase10-' || substr(md5(random()::text), 1, 8))::text;
reset role; reset request.jwt.claims;

do $$
declare uid text;
begin
  select value into uid from test_ids where key = 'user_b';
  execute 'set role authenticated';
  execute format('set request.jwt.claims to %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;
insert into test_ids(key, value)
select 'org_b', create_organization_with_defaults('Org B Fase10', 'org-b-fase10-' || substr(md5(random()::text), 1, 8))::text;
reset role; reset request.jwt.claims;

select * from test_ids order by key;
commit;

-- Passo 2 — insert na própria org (ids literais do passo 1 na execução real).
-- Passo 3 — insert/select cross-tenant.
-- Passo 4 — is_contact_suppressed (normalização + isolamento).
-- Passo 5 — check_rate_limit como anon.
-- Passo 6 — claim_next_job bloqueado para authenticated/anon.
-- Passo 7 — ciclo de vida de job real (enqueue → claim → segunda tentativa vazia).
--
-- Cada um rodou como uma query separada nesta sessão, usando os ids
-- literais retornados pelo passo 1 (ver histórico da sessão) em vez de
-- repetir a criação de usuários/orgs — reproduzir integralmente exige
-- substituir os ids abaixo pelos que a sua própria execução do passo 1
-- retornar.
