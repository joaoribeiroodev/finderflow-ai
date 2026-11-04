-- Fase 7: o relatório "conversão por responsável" precisa resolver o nome
-- de QUALQUER membro da organização (não só o do usuário logado) a partir
-- de leads.assigned_to. A policy anterior (profiles_select_self) só
-- permitia a cada usuário ler o próprio perfil.

create or replace function public.shares_org_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_members me
    join public.organization_members them
      on them.organization_id = me.organization_id
    where me.user_id = auth.uid()
      and them.user_id = target_user
  );
$$;

revoke all on function public.shares_org_with(uuid) from public;

create policy profiles_select_org_peers
  on public.profiles
  for select
  to authenticated
  using (public.shares_org_with(id));
