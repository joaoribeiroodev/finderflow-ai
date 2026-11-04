-- Fix: funções SECURITY DEFINER sensíveis continuavam executáveis pelo role
-- `anon` mesmo após `revoke all on function ... from public;` na migration
-- `core_schema`.
--
-- Causa raiz: o provisionamento do Supabase concede EXECUTE diretamente ao
-- role `anon` (e a `authenticated`/`service_role`) no momento da criação da
-- função, como grant nomeado — não via PUBLIC. `REVOKE ... FROM PUBLIC` não
-- remove um grant feito diretamente a um role nomeado, então o `anon`
-- mantinha acesso de execução mesmo com o revoke explícito já presente no
-- código da migration original.
--
-- Encontrado via mcp__Supabase__get_advisors(type="security") logo após
-- aplicar `core_schema` neste projeto (lxzsefabmnagiaywaxeb) e confirmado
-- consultando pg_proc.proacl diretamente. Esta migration espelha no
-- repositório a correção que já havia sido aplicada ao vivo (idempotente:
-- pode ser reaplicada sem efeito colateral).
--
-- `set_updated_at` (trigger utilitário, não SECURITY DEFINER) também tinha
-- EXECUTE concedido a PUBLIC/anon/authenticated; revogado por higiene, já
-- que ninguém deveria chamá-la via RPC — e corrigido o aviso
-- `function_search_path_mutable` fixando `search_path`.

-- Funções SECURITY DEFINER usadas pelas policies de RLS e pela criação de
-- organização: apenas `authenticated` deve poder executá-las via API.
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.has_org_role(uuid, public.org_role[]) from public, anon;
revoke all on function public.can_edit_org(uuid) from public, anon;
revoke all on function public.can_admin_org(uuid) from public, anon;
revoke all on function public.create_organization_with_defaults(text, text) from public, anon;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role[]) to authenticated;
grant execute on function public.can_edit_org(uuid) to authenticated;
grant execute on function public.can_admin_org(uuid) to authenticated;
grant execute on function public.create_organization_with_defaults(text, text) to authenticated;

-- Trigger de criação de perfil ao cadastrar em auth.users: só o Postgres
-- (via trigger) deve invocá-la, nunca via RPC pública.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- Trigger utilitário de updated_at: idem, apenas uso interno via trigger.
revoke all on function public.set_updated_at() from public, anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
