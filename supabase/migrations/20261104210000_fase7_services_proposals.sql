-- Fase 7 — Serviços, propostas, negócios e relatórios.
--
-- 1. `proposals.status` era `text` livre (sem check) desde a Fase 0/1 — a
--    Fase 7 fixa o conjunto de valores válidos do ciclo de vida da proposta
--    (draft/sent/accepted/rejected/expired). "expired" é calculado em
--    leitura a partir de `valid_until` (não há job dedicado só para isso,
--    ver docs/DECISIONS.md), mas o valor também pode ser persistido quando
--    o usuário resolve uma proposta vencida explicitamente.
-- 2. Totais de proposta: em vez de confiar no aplicativo para manter
--    `proposal_items.total` e `proposals.total_amount` consistentes (duas
--    fontes de verdade divergentes são exatamente o tipo de risco que o
--    prompt mestre pede para evitar em métricas), um trigger no banco é a
--    fonte única de verdade — qualquer insert/update/delete em
--    `proposal_items` recalcula `total` da própria linha e o agregado da
--    proposta.
-- 3. `deals.lost_reason`: a Fase 0/1 já modelou `deals.status` como
--    open/won/lost, mas sem coluna de motivo (FF-094 pede "registrar
--    ganho/perda e motivo"). Reaproveita a mesma convenção de
--    `leads.loss_reason` (texto livre, nulo quando não aplicável).
-- 4. Bucket de storage privado para os PDFs de proposta, com policies
--    escopadas por organização via prefixo do path
--    (`{organization_id}/{proposal_id}.pdf`), usando as mesmas funções
--    `is_org_member`/`can_edit_org` já usadas nas tabelas — nunca por
--    `organization_id` vindo do cliente sem revalidação.

alter table public.proposals
  drop constraint if exists proposals_status_check;
alter table public.proposals
  add constraint proposals_status_check
  check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired'));

alter table public.deals
  add column if not exists lost_reason text;

create or replace function public.recompute_proposal_total(p_proposal_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.proposals
  set total_amount = coalesce(
    (select sum(total) from public.proposal_items where proposal_id = p_proposal_id),
    0
  )
  where id = p_proposal_id;
$$;
revoke all on function public.recompute_proposal_total(uuid) from public, anon, authenticated;

create or replace function public.proposal_items_before_write()
returns trigger
language plpgsql
as $$
begin
  new.total = round(new.quantity * new.unit_price, 2);
  return new;
end;
$$;

create or replace function public.proposal_items_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_proposal_total(old.proposal_id);
  else
    perform public.recompute_proposal_total(new.proposal_id);
  end if;
  return null;
end;
$$;

drop trigger if exists proposal_items_before_write_trg on public.proposal_items;
create trigger proposal_items_before_write_trg
  before insert or update on public.proposal_items
  for each row execute procedure public.proposal_items_before_write();

drop trigger if exists proposal_items_after_write_trg on public.proposal_items;
create trigger proposal_items_after_write_trg
  after insert or update or delete on public.proposal_items
  for each row execute procedure public.proposal_items_after_write();

-- Bucket privado de PDFs de proposta.
insert into storage.buckets (id, name, public)
values ('proposals', 'proposals', false)
on conflict (id) do nothing;

drop policy if exists proposals_pdf_select on storage.objects;
create policy proposals_pdf_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'proposals'
    and public.is_org_member((split_part(name, '/', 1))::uuid)
  );

drop policy if exists proposals_pdf_write on storage.objects;
create policy proposals_pdf_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'proposals'
    and public.can_edit_org((split_part(name, '/', 1))::uuid)
  );

drop policy if exists proposals_pdf_update on storage.objects;
create policy proposals_pdf_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'proposals'
    and public.can_edit_org((split_part(name, '/', 1))::uuid)
  )
  with check (
    bucket_id = 'proposals'
    and public.can_edit_org((split_part(name, '/', 1))::uuid)
  );

drop policy if exists proposals_pdf_delete on storage.objects;
create policy proposals_pdf_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'proposals'
    and public.can_admin_org((split_part(name, '/', 1))::uuid)
  );
