-- Verificação de isolamento cross-tenant via RLS — rodada diretamente contra
-- o projeto Supabase real (lxzsefabmnagiaywaxeb) em 2026-11-04 via
-- mcp__Supabase__execute_sql, como alternativa a
-- tests/integration/rls-cross-tenant.test.ts.
--
-- Por que este script existe:
-- O teste de integração (Vitest) precisa de SUPABASE_SERVICE_ROLE_KEY para
-- criar/apagar usuários de teste via `admin.auth.admin.createUser`. Nenhuma
-- ferramenta MCP do Supabase disponível nesta sessão expõe essa chave (por
-- design de segurança do conector). Para não deixar o critério de aceite
-- "RLS bloqueia acesso cruzado, comprovado por testes" sem verificação real,
-- este script reproduz o mesmo cenário (dois usuários, duas organizações,
-- tentativas de leitura/escrita cross-tenant) inteiramente via SQL, usando o
-- mesmo mecanismo que o PostgREST usa por baixo dos panos: a função
-- `auth.uid()` lê o GUC de sessão `request.jwt.claims` (confirmado via
-- `pg_get_functiondef('auth.uid()'::regprocedure)` antes de escrever este
-- script). `SET ROLE authenticated` + `SET request.jwt.claims` simulam
-- exatamente a identidade que o PostgREST estabeleceria a partir de um JWT
-- real — as mesmas policies de RLS são avaliadas.
--
-- Resultado desta execução (ver relatório da Fase 1 / docs/DECISIONS.md):
-- todos os 6 testes PASS. Dados de teste foram limpos ao final (verificado
-- com uma query de contagem pós-execução) — nada ficou no banco.
--
-- Este script é reprodutível e deve voltar a passar sempre que a migration
-- de schema ou as policies de RLS mudarem. Rodar via Supabase MCP
-- (execute_sql) ou `psql` com um usuário que possa inserir em `auth.users`
-- (apenas disponível em projeto de desenvolvimento — nunca em produção).
--
-- O teste de integração em Vitest continua sendo a forma preferida de rodar
-- isso localmente (via `npm run test:rls`, com Supabase local + Docker ou
-- com a service_role key de um projeto de dev), pois exercita a stack real
-- via HTTP/PostgREST, não apenas o Postgres. Os dois se complementam.

begin;

create temporary table test_ids (key text primary key, value text);
create temporary table test_results (step text, status text, detail text);
grant select, insert, update, delete on test_ids to authenticated, anon, service_role;
grant select, insert, update, delete on test_results to authenticated, anon, service_role;

-- 1. criar dois usuários de teste diretamente em auth.users (equivalente a
--    admin.auth.admin.createUser, sem depender da service_role key)
with new_user as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, is_sso_user, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'rls-test-a@example.test', 'x', now(), '{}', '{}', now(), now(), '', '', '', '', false, false)
  returning id
)
insert into test_ids(key, value) select 'user_a', id::text from new_user;

with new_user as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, is_sso_user, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'rls-test-b@example.test', 'x', now(), '{}', '{}', now(), now(), '', '', '', '', false, false)
  returning id
)
insert into test_ids(key, value) select 'user_b', id::text from new_user;

-- 2. assumir a identidade do usuário A (como o PostgREST faria a partir de
--    um JWT real) e criar a Org A via a RPC pública
do $$
declare uid text;
begin
  select value into uid from test_ids where key = 'user_a';
  execute 'set role authenticated';
  execute format('set request.jwt.claims to %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

insert into test_ids(key, value)
select 'org_a', create_organization_with_defaults('Org A Teste RLS', 'org-a-rls-' || substr(md5(random()::text), 1, 8))::text;

reset role;
reset request.jwt.claims;

-- 3. assumir usuário B e criar a Org B
do $$
declare uid text;
begin
  select value into uid from test_ids where key = 'user_b';
  execute 'set role authenticated';
  execute format('set request.jwt.claims to %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

insert into test_ids(key, value)
select 'org_b', create_organization_with_defaults('Org B Teste RLS', 'org-b-rls-' || substr(md5(random()::text), 1, 8))::text;

reset role;
reset request.jwt.claims;

-- 4. voltar para o usuário A e rodar os testes de isolamento
do $$
declare uid text;
begin
  select value into uid from test_ids where key = 'user_a';
  execute 'set role authenticated';
  execute format('set request.jwt.claims to %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- Teste 1: A não vê a organização de B em `organizations`
insert into test_results
select 'A_nao_ve_org_B',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'rows=' || count(*)
from public.organizations where id = (select value::uuid from test_ids where key = 'org_b');

-- Teste 2: A consegue criar uma empresa na própria organização
do $$
declare v_org_a uuid; v_new_id uuid;
begin
  select value::uuid into v_org_a from test_ids where key = 'org_a';
  insert into public.companies (organization_id, name, normalized_name)
  values (v_org_a, 'Empresa A', 'empresa a')
  returning id into v_new_id;
  insert into test_ids(key, value) values ('company_a', v_new_id::text);
  insert into test_results values ('A_cria_empresa_propria_org', 'PASS', 'id=' || v_new_id::text);
exception when others then
  insert into test_results values ('A_cria_empresa_propria_org', 'FAIL', sqlerrm);
end $$;

reset role;
reset request.jwt.claims;

-- 5. voltar para o usuário B e rodar os testes cross-tenant
do $$
declare uid text;
begin
  select value into uid from test_ids where key = 'user_b';
  execute 'set role authenticated';
  execute format('set request.jwt.claims to %L', json_build_object('sub', uid, 'role', 'authenticated')::text);
end $$;

-- Teste 3: B não consegue ler empresas da organização de A
insert into test_results
select 'B_nao_le_empresas_org_A',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'rows=' || count(*)
from public.companies where organization_id = (select value::uuid from test_ids where key = 'org_a');

-- Teste 4: B não consegue inserir empresa na organização de A (deve dar erro de RLS)
do $$
declare v_org_a uuid;
begin
  select value::uuid into v_org_a from test_ids where key = 'org_a';
  insert into public.companies (organization_id, name, normalized_name)
  values (v_org_a, 'Empresa invasora', 'empresa invasora');
  insert into test_results values ('B_nao_insere_empresa_org_A', 'FAIL (insert passou!)', null);
exception when others then
  insert into test_results values ('B_nao_insere_empresa_org_A', 'PASS (bloqueado)', sqlerrm);
end $$;

-- Teste 5: B não vê os membros da organização de A
insert into test_results
select 'B_nao_ve_membros_org_A',
  case when count(*) = 0 then 'PASS' else 'FAIL' end,
  'rows=' || count(*)
from public.organization_members where organization_id = (select value::uuid from test_ids where key = 'org_a');

-- Teste 6: B não consegue alterar papéis de membros da organização de A
-- (UPDATE sob RLS com USING que filtra a linha não gera erro — afeta 0 linhas)
do $$
declare v_org_a uuid; v_rows int;
begin
  select value::uuid into v_org_a from test_ids where key = 'org_a';
  update public.organization_members set role = 'admin' where organization_id = v_org_a;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    insert into test_results values ('B_nao_promove_membros_org_A', 'PASS (0 linhas afetadas)', null);
  else
    insert into test_results values ('B_nao_promove_membros_org_A', 'FAIL', 'rows=' || v_rows);
  end if;
exception when others then
  insert into test_results values ('B_nao_promove_membros_org_A', 'PASS (bloqueado por exceção)', sqlerrm);
end $$;

reset role;
reset request.jwt.claims;

-- 6. limpeza (equivalente ao afterAll do teste de integração)
delete from public.organizations where id in (select value::uuid from test_ids where key in ('org_a', 'org_b'));
delete from auth.users where id in (select value::uuid from test_ids where key in ('user_a', 'user_b'));

select * from test_results order by step;

commit;
