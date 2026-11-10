-- Exclusão de usuário pelo painel /admin (super admin). Faltava: o painel
-- já tinha ativar/desativar, redefinir senha e conceder/revogar super
-- admin (ver src/modules/admin/actions.ts), mas nenhuma forma de excluir
-- a conta de verdade.
--
-- `profiles` e `organization_members` já referenciam `auth.users(id) on
-- delete cascade` (migração core), então apagar a linha em `auth.users`
-- (feito em código, via `admin.auth.admin.deleteUser`, nunca por SQL
-- direto — é a Service Role do GoTrue que invalida sessões/refresh
-- tokens) já limpa o perfil e os vínculos de organização sozinho.
--
-- O que falta tratar à parte: organizações em que este usuário é o único
-- `owner`. Se a organização tiver outros membros, a conta não pode ser
-- excluída sem deixar a organização sem proprietário — a função bloqueia
-- e devolve quais organizações precisam de uma troca de titularidade (ou
-- exclusão) antes. Se a organização só tem este usuário, ela é apagada
-- junto (mesmo cascade de `delete_organization_cascade`: os dados de
-- negócio já têm `on delete cascade` em `organizations(id)`; só os
-- segredos do Vault — Asaas/OpenAI/Gmail — precisam de limpeza
-- explícita, porque a FK ali é `on delete set null`).
--
-- `p_dry_run` permite ao código calcular a lista de organizações a
-- apagar (para limpar os PDFs de proposta no Storage, que a SQL não
-- alcança) antes de confirmar a exclusão de verdade — mesmo padrão de
-- "calcular primeiro, mutar depois" usado para não duplicar a regra de
-- negócio entre TypeScript e SQL.
create or replace function public.admin_delete_user_cascade(p_user uuid, p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocked jsonb;
  v_sole_owned jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug)), '[]'::jsonb)
  into v_blocked
  from public.organizations o
  where o.id in (
    select om.organization_id
    from public.organization_members om
    where om.user_id = p_user and om.role = 'owner'
  )
  and (select count(*) from public.organization_members om2 where om2.organization_id = o.id) > 1;

  if jsonb_array_length(v_blocked) > 0 then
    return jsonb_build_object('blocked', true, 'blockedOrganizations', v_blocked, 'deletedOrganizations', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug)), '[]'::jsonb)
  into v_sole_owned
  from public.organizations o
  where o.id in (
    select om.organization_id
    from public.organization_members om
    where om.user_id = p_user and om.role = 'owner'
  )
  and (select count(*) from public.organization_members om2 where om2.organization_id = o.id) = 1;

  if p_dry_run then
    return jsonb_build_object('blocked', false, 'blockedOrganizations', '[]'::jsonb, 'deletedOrganizations', v_sole_owned);
  end if;

  delete from vault.secrets
  where id in (
    select unnest(array_remove(array[c.asaas_secret_id, c.openai_secret_id, c.gmail_secret_id], null))
    from public.organization_integration_credentials c
    where c.organization_id in (select (elem ->> 'id')::uuid from jsonb_array_elements(v_sole_owned) elem)
  );

  delete from public.organizations
  where id in (select (elem ->> 'id')::uuid from jsonb_array_elements(v_sole_owned) elem);

  return jsonb_build_object('blocked', false, 'blockedOrganizations', '[]'::jsonb, 'deletedOrganizations', v_sole_owned);
end;
$$;

revoke all on function public.admin_delete_user_cascade(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_delete_user_cascade(uuid, boolean) to service_role;
