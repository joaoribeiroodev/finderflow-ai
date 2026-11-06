-- Fase 9 (hardening): fecha escalonamento de privilégio em
-- `profiles.is_super_admin`.
--
-- `profiles_update_self` (migração core) permite que o próprio usuário
-- atualize sua linha em `public.profiles` sem restrição de coluna. A
-- coluna `is_super_admin` foi adicionada depois (fase 9) e nunca ganhou
-- proteção própria — ou seja, qualquer usuário autenticado podia rodar
-- `supabase.from("profiles").update({ is_super_admin: true })` e virar
-- super admin da plataforma sozinho. Esta migração fecha isso com um
-- trigger: qualquer tentativa de mudar `is_super_admin` fora de uma
-- chamada com a service role key (o painel admin usa o cliente admin
-- para conceder/revogar) é silenciosamente revertida, sem quebrar a
-- atualização legítima dos demais campos do próprio perfil na mesma
-- requisição.
create or replace function public.protect_is_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin then
    if coalesce(auth.role(), '') <> 'service_role' then
      new.is_super_admin := old.is_super_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_is_super_admin on public.profiles;
create trigger profiles_protect_is_super_admin
  before update on public.profiles
  for each row
  execute function public.protect_is_super_admin();

revoke all on function public.protect_is_super_admin() from public, anon, authenticated;
