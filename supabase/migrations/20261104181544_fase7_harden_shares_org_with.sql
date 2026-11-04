-- Fase 7: corrige achado do security advisor — shares_org_with era
-- executável pela role anon via PostgREST.

revoke all on function public.shares_org_with(uuid) from public, anon;
grant execute on function public.shares_org_with(uuid) to authenticated;
