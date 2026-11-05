-- Fix: `set_updated_at` (trigger utilitário, não SECURITY DEFINER) também
-- tinha EXECUTE concedido a PUBLIC/anon/authenticated; revogado por higiene,
-- já que ninguém deveria chamá-la via RPC — e corrigido o aviso
-- `function_search_path_mutable` fixando `search_path`.
--
-- Esta migration espelha no repositório a correção que já havia sido
-- aplicada ao vivo neste projeto (lxzsefabmnagiaywaxeb) logo após
-- `fix_function_privileges` (idempotente: pode ser reaplicada sem efeito
-- colateral).

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
