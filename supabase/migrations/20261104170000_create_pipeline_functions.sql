-- Fase 4 (CRM): funções SECURITY DEFINER para operações que precisam ser
-- atômicas e que a RLS por si só não protege adequadamente:
--
-- 1. reorder_pipeline_stages: trocar a posição de várias etapas do funil
--    em uma única operação. A tabela `pipeline_stages` tem
--    `unique (organization_id, position)`, então um UPDATE simples que
--    tenta "trocar" duas posições violaria a constraint no meio da
--    operação (constraints não-deferráveis são checadas por linha).
--    A função usa um deslocamento temporário negativo (garantidamente
--    livre de colisão, pois é uma transformação monotônica das posições
--    atuais, que já são únicas) antes de aplicar as posições finais.
--
-- 2. move_lead_stage: mover um lead de etapa e registrar o histórico
--    (`lead_stage_history`) como uma única operação atômica, e aplicar a
--    regra de negócio de sincronizar `leads.status`/`loss_reason` com o
--    tipo de resultado da etapa de destino (`pipeline_stages.result_type`).
--    Fazer isso em dois passos (ler etapa atual, depois gravar) a partir
--    do cliente teria uma janela de corrida entre leitura e escrita;
--    aqui é uma única transação no banco.

create or replace function public.reorder_pipeline_stages(
  p_organization_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_total integer;
  v_distinct integer;
  v_matching integer;
  v_id uuid;
  v_idx integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not public.can_edit_org(p_organization_id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_ordered_ids is null or array_length(p_ordered_ids, 1) is null then
    raise exception 'ordered_ids vazio' using errcode = '22023';
  end if;

  select count(*) into v_total from public.pipeline_stages where organization_id = p_organization_id;
  select count(distinct x) into v_distinct from unnest(p_ordered_ids) x;
  select count(*) into v_matching
    from public.pipeline_stages
    where organization_id = p_organization_id and id = any(p_ordered_ids);

  if v_distinct <> array_length(p_ordered_ids, 1)
    or v_total <> array_length(p_ordered_ids, 1)
    or v_matching <> v_total then
    raise exception 'lista de etapas inválida: precisa conter exatamente todas as etapas da organização, sem repetição' using errcode = '22023';
  end if;

  -- Passo 1: deslocar todas as posições atuais para negativos únicos
  -- (transformação injetiva: posições distintas continuam distintas).
  update public.pipeline_stages
  set position = -position - 1000000
  where organization_id = p_organization_id;

  -- Passo 2: aplicar a ordem final solicitada.
  v_idx := 1;
  foreach v_id in array p_ordered_ids loop
    update public.pipeline_stages
    set position = v_idx
    where id = v_id and organization_id = p_organization_id;
    v_idx := v_idx + 1;
  end loop;
end;
$$;
revoke all on function public.reorder_pipeline_stages(uuid, uuid[]) from public;
grant execute on function public.reorder_pipeline_stages(uuid, uuid[]) to authenticated;

create or replace function public.move_lead_stage(
  p_lead_id uuid,
  p_to_stage_id uuid,
  p_loss_reason text default null
)
returns public.leads
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org uuid;
  v_from_stage uuid;
  v_to_is_closed boolean;
  v_to_result text;
  v_lead public.leads;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select organization_id, stage_id into v_org, v_from_stage
  from public.leads
  where id = p_lead_id;

  if v_org is null then
    raise exception 'lead não encontrado' using errcode = 'P0002';
  end if;
  if not public.can_edit_org(v_org) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select is_closed, result_type into v_to_is_closed, v_to_result
  from public.pipeline_stages
  where id = p_to_stage_id and organization_id = v_org;

  if v_to_is_closed is null then
    raise exception 'etapa de destino inválida para esta organização' using errcode = '22023';
  end if;

  if v_from_stage = p_to_stage_id then
    select * into v_lead from public.leads where id = p_lead_id;
    return v_lead;
  end if;

  update public.leads
  set stage_id = p_to_stage_id,
      status = case
        when v_to_result = 'won' then 'won'::public.lead_status
        when v_to_result = 'lost' then 'lost'::public.lead_status
        else 'open'::public.lead_status
      end,
      loss_reason = case when v_to_result = 'lost' then coalesce(p_loss_reason, loss_reason) else null end,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  insert into public.lead_stage_history (organization_id, lead_id, from_stage_id, to_stage_id, changed_by)
  values (v_org, p_lead_id, v_from_stage, p_to_stage_id, auth.uid());

  return v_lead;
end;
$$;
revoke all on function public.move_lead_stage(uuid, uuid, text) from public;
grant execute on function public.move_lead_stage(uuid, uuid, text) to authenticated;
