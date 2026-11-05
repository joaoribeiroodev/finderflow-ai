-- Fase 8 (hardening): corrige achado de performance "multiple permissive
-- policies" — profiles tinha duas policies permissivas de SELECT para
-- authenticated (profiles_select_self e profiles_select_org_peers), que o
-- Postgres precisa avaliar e combinar (OR) em toda consulta. Mescladas em
-- uma única policy equivalente.
--
-- shares_org_with(id) já cobre o próprio usuário quando ele pertence a
-- alguma organização, mas NÃO cobre o caso de um usuário recém-criado
-- (onboarding, antes de criar/entrar em uma organização) — por isso o OR
-- explícito com auth.uid() é mantido.

drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_select_org_peers on public.profiles;

create policy profiles_select_visible
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id));
