-- Fase 7: corrige achados do security advisor nos triggers de total de
-- proposta introduzidos pela migration anterior (fase7_services_proposals):
-- search_path mutável e execução por authenticated/anon.

create or replace function public.proposal_items_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.total := round(new.quantity * new.unit_price, 2);
  return new;
end;
$$;

revoke all on function public.proposal_items_before_write() from public, anon, authenticated;

revoke all on function public.proposal_items_after_write() from public, anon, authenticated;
