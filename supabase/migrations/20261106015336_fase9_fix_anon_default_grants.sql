-- Supabase concede EXECUTE a anon/authenticated/service_role por
-- default privileges no schema public na criação da função — "revoke
-- ... from public" não remove esses grants específicos de role.
-- Corrige: revoga explicitamente de anon em todas as funções sensíveis
-- desta fase (nenhuma delas deve ser chamável sem sessão).
revoke execute on function public.is_platform_super_admin() from anon;
revoke execute on function public.set_org_asaas_credentials(uuid, text, text) from anon;
revoke execute on function public.clear_org_asaas_credentials(uuid) from anon;
revoke execute on function public.set_org_openai_credentials(uuid, text, text) from anon;
revoke execute on function public.clear_org_openai_credentials(uuid) from anon;
revoke execute on function public.get_org_asaas_api_key(uuid) from anon;
revoke execute on function public.get_org_openai_api_key(uuid) from anon;
