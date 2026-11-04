-- Fase 7: no máximo um negócio por proposta.

create unique index if not exists deals_one_per_proposal_idx
  on public.deals (organization_id, proposal_id)
  where proposal_id is not null;
