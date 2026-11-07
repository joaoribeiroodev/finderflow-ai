-- Fase 10 — Fundações de infraestrutura para a evolução do FinderFlow AI
-- em plataforma de inteligência comercial B2B (ver ETAPA-0-AUDITORIA.md,
-- auditoria aprovada pelo usuário em 2026-11-07).
--
-- Esta migration implementa só os itens de fundação que não dependem de
-- contratar um fornecedor novo (decisão de negócio ainda pendente —
-- ver seção 6 da auditoria): lista de supressão (LGPD), fila
-- assíncrona real sobre a tabela `jobs` já existente, e rate limiting
-- distribuído via Postgres (resolve a limitação documentada em
-- src/lib/security/rate-limit.ts sem exigir Redis/Upstash).
--
-- Observabilidade (Sentry/APM) e backups (upgrade do plano Supabase)
-- continuam fora do código — dependem de conta/decisão do usuário em um
-- painel externo, não de uma migration.

-- ===========================================================================
-- 1. Lista de supressão (LGPD — oposição a contato / descadastro)
-- ===========================================================================

-- Normaliza e-mail (lowercase/trim) e telefone (apenas dígitos) antes de
-- comparar — sem isso, "Fulano@Empresa.com" e "fulano@empresa.com"
-- seriam tratados como contatos diferentes e a supressão falharia.
create or replace function public.normalize_contact_value(p_type text, p_value text)
returns text
language sql
immutable
as $$
  select case
    when p_type = 'email' then lower(trim(p_value))
    else regexp_replace(p_value, '\D', '', 'g')
  end;
$$;

create table public.suppression_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact_value text not null,
  normalized_value text generated always as (public.normalize_contact_value(contact_type, contact_value)) stored,
  reason text not null default 'manual' check (reason in ('opt_out', 'bounce', 'complaint', 'manual')),
  source text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Um mesmo contato não pode ter duas entradas de supressão na mesma
-- organização — a checagem de "está suprimido?" é um EXISTS, não importa
-- duplicar motivo/origem.
create unique index suppression_entries_org_contact_uidx
  on public.suppression_entries (organization_id, contact_type, normalized_value);
create index suppression_entries_org_idx on public.suppression_entries (organization_id);

alter table public.suppression_entries enable row level security;

create policy suppression_entries_select_member on public.suppression_entries
  for select to authenticated using (public.is_org_member(organization_id));

create policy suppression_entries_insert_member on public.suppression_entries
  for insert to authenticated with check (public.is_org_member(organization_id));

-- Remover uma supressão é uma decisão mais sensível (reabre a porta para
-- contatar alguém que pediu para não ser contatado) — restrita a
-- owner/admin, igual a outras ações administrativas desta organização.
create policy suppression_entries_delete_admin on public.suppression_entries
  for delete to authenticated using (public.can_admin_org(organization_id));

-- Checagem central que qualquer rotina de envio (campanha, cadência,
-- WhatsApp — quando existirem) DEVE chamar antes de contatar alguém.
-- security definer + search_path fixo (gotcha já documentado neste
-- projeto: privilégios padrão concedem EXECUTE a anon/authenticated
-- diretamente, então revoke explícito é obrigatório).
create or replace function public.is_contact_suppressed(p_org uuid, p_type text, p_value text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.suppression_entries
    where organization_id = p_org
      and contact_type = p_type
      and normalized_value = public.normalize_contact_value(p_type, p_value)
  );
$$;
revoke all on function public.is_contact_suppressed(uuid, text, text) from public, anon;
grant execute on function public.is_contact_suppressed(uuid, text, text) to authenticated;

-- ===========================================================================
-- 2. Rate limiting distribuído (Postgres — sem novo fornecedor)
-- ===========================================================================
--
-- Substitui/complementa o contador em memória de src/lib/security/rate-limit.ts
-- (limitação documentada ali: "N por instância", não "N globalmente").
-- Sem policies de acesso direto — só a função abaixo (security definer)
-- toca esta tabela.

create table public.rate_limit_counters (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);
create index rate_limit_counters_reset_at_idx on public.rate_limit_counters (reset_at);

alter table public.rate_limit_counters enable row level security;
-- Sem policies: acesso exclusivo via check_rate_limit() (security definer).

-- Janela fixa simples (mesmo modelo do contador em memória que substitui/
-- complementa) implementada como "upsert atômico": tenta UPDATE primeiro
-- (caminho comum, chave já existe); se não encontrar linha, tenta INSERT;
-- se perder a corrida de criação para outra requisição concorrente,
-- repete o loop — agora o UPDATE encontra a linha.
create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.rate_limit_counters;
begin
  loop
    update public.rate_limit_counters
    set count = case when reset_at <= v_now then 1 else count + 1 end,
        reset_at = case when reset_at <= v_now then v_now + make_interval(secs => p_window_seconds) else reset_at end
    where key = p_key
    returning * into v_row;

    if found then
      exit;
    end if;

    begin
      insert into public.rate_limit_counters (key, count, reset_at)
      values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
      returning * into v_row;
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;

  return query select (v_row.count <= p_limit), greatest(p_limit - v_row.count, 0), v_row.reset_at;
end;
$$;
revoke all on function public.check_rate_limit(text, integer, integer) from public;
-- Precisa ser chamável por requisições não autenticadas (ex.: POST em
-- /login antes de existir sessão) — por isso, diferente da maioria das
-- funções deste projeto, concede a anon também, deliberadamente: a
-- função só lê/escreve `rate_limit_counters` (sem dado sensível) e nunca
-- aceita identificar nada além da chave de limite já computada pelo chamador.
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated;

-- ===========================================================================
-- 3. Fila assíncrona real sobre `jobs` (schema já existia, sem worker)
-- ===========================================================================
--
-- Claim atômico com SKIP LOCKED — necessário porque múltiplas invocações
-- do worker (ex.: Vercel Cron se sobrepondo) não podem reivindicar o
-- mesmo job. O resto do ciclo de vida (completar/falhar/reagendar) é
-- feito em código via cliente admin (service role já ignora RLS para
-- UPDATE/INSERT comuns, só o SELECT ... FOR UPDATE SKIP LOCKED exige
-- uma função porque o PostgREST/supabase-js não expõe essa sintaxe).
create or replace function public.claim_next_job(p_job_types text[] default null, p_worker text default 'worker')
returns public.jobs
language sql
security definer
set search_path = public
as $$
  with next_job as (
    select id from public.jobs
    where status = 'queued'
      and run_after <= now()
      and (p_job_types is null or job_type = any(p_job_types))
    order by run_after asc
    for update skip locked
    limit 1
  )
  update public.jobs
  set status = 'processing', locked_at = now(), locked_by = p_worker, attempts = attempts + 1
  where id in (select id from next_job)
  returning *;
$$;
revoke all on function public.claim_next_job(text[], text) from public, anon, authenticated;
