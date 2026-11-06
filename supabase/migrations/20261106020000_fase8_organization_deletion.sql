-- Fase 8 (hardening): exclusão completa da organização — última peça do
-- card "Privacidade e segurança" em Configurações (export já implementado
-- em código/API, sem precisar de função no banco).
--
-- Todas as tabelas de negócio já referenciam `organizations(id)` com
-- `on delete cascade` (ver migração core), então apagar a linha em
-- `organizations` já limpa companies/leads/proposals/deals/contratos/
-- outreach/etc. sozinho, por desenho do schema — não precisamos (nem
-- devemos) reescrever manualmente uma lista de deletes tabela por
-- tabela, que ficaria desatualizada a cada nova tabela.
--
-- O que o cascade NÃO alcança, e que esta função cuida explicitamente:
-- os segredos no Vault (asaas/openai/gmail) referenciados por
-- `organization_integration_credentials` — a FK é `on delete set null`
-- nessa direção, então o segredo ficaria órfão no Vault para sempre se
-- não fosse apagado aqui antes.
--
-- Restrito ao "owner" da organização (não "admin") — é a ação mais
-- destrutiva e irreversível do sistema.
create or replace function public.delete_organization_cascade(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_org_role(p_org, array['owner']::public.org_role[]) then
    raise exception 'only the organization owner can delete the organization' using errcode = '42501';
  end if;

  delete from vault.secrets
  where id in (
    select unnest(array_remove(array[asaas_secret_id, openai_secret_id, gmail_secret_id], null))
    from public.organization_integration_credentials
    where organization_id = p_org
  );

  delete from public.organizations where id = p_org;
end;
$$;

revoke all on function public.delete_organization_cascade(uuid) from public, anon;
grant execute on function public.delete_organization_cascade(uuid) to authenticated;
