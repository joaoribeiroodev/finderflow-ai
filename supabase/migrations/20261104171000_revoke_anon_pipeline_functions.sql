-- Advisor de segurança (mcp__Supabase__get_advisors) apontou que `anon`
-- conseguia executar move_lead_stage e reorder_pipeline_stages via
-- PostgREST, apesar do `revoke all ... from public` já presente na
-- migration que as criou (20261104170000_create_pipeline_functions.sql).
--
-- Causa: privilégios padrão do projeto (`pg_default_acl`) concedem
-- EXECUTE em novas funções diretamente a anon/authenticated/service_role
-- (não via o pseudo-role PUBLIC) — revogar de PUBLIC não afeta essas
-- concessões diretas. As funções mais antigas da Fase 0/1
-- (is_org_member, can_edit_org etc.) não têm `anon` na ACL porque foram
-- criadas antes dessa configuração de privilégios padrão existir no
-- projeto; as novas funções desta fase, sim.
--
-- Corrigindo explicitamente para igualar o comportamento esperado em
-- todo o projeto: só `authenticated` pode chamar essas RPCs. Encontrado
-- e corrigido durante o fechamento da Fase 4, antes do commit — ver
-- docs/DECISIONS.md.
revoke all on function public.move_lead_stage(uuid, uuid, text) from anon;
revoke all on function public.reorder_pipeline_stages(uuid, uuid[]) from anon;
