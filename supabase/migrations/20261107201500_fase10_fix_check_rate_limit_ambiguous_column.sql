-- Corrige bug real encontrado na verificação ao vivo (ver
-- supabase/tests/fase10-foundations-verification.sql): `returns table(...,
-- reset_at timestamptz)` cria uma variável OUT implícita `reset_at` que
-- colidia com a coluna `rate_limit_counters.reset_at` dentro do próprio
-- UPDATE, causando "column reference reset_at is ambiguous" em toda
-- chamada. Corrigido qualificando a tabela com alias.
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
    update public.rate_limit_counters rlc
    set count = case when rlc.reset_at <= v_now then 1 else rlc.count + 1 end,
        reset_at = case when rlc.reset_at <= v_now then v_now + make_interval(secs => p_window_seconds) else rlc.reset_at end
    where rlc.key = p_key
    returning rlc.* into v_row;

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
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated;
