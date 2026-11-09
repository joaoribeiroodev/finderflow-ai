-- Evolução (2026-11-09) — agendador da fila assíncrona dentro do próprio
-- Supabase (pg_cron + pg_net, ambos open source e incluídos no plano
-- gratuito), no lugar do Vercel Cron.
--
-- Por quê: o plano Hobby da Vercel só permite cron 1x/dia, e o cron da
-- Vercel só autentica se `CRON_SECRET` estiver configurada no projeto —
-- não estava, então o worker respondia 401 e a fila nunca foi drenada em
-- produção. Aqui o próprio banco chama o worker a cada 5 minutos com um
-- token que ele mesmo gera e guarda no Vault; o worker confirma o token de
-- volta no banco (`verify_jobs_worker_token`). Nenhum segredo precisa ser
-- copiado para painel nenhum.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Token aleatório de 256 bits, gerado e guardado só dentro do banco.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'jobs_worker_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'jobs_worker_token',
      'Token que o pg_cron envia ao worker da fila (/api/v1/jobs/worker)'
    );
  end if;
end $$;

-- O worker chama esta função (via service_role) para validar o token
-- recebido no header Authorization.
create or replace function public.verify_jobs_worker_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select sha256(convert_to(s.decrypted_secret, 'UTF8')) = sha256(convert_to(p_token, 'UTF8'))
      from vault.decrypted_secrets s
      where s.name = 'jobs_worker_token'
    ),
    false
  );
$$;
revoke execute on function public.verify_jobs_worker_token(text) from public, anon, authenticated;
grant execute on function public.verify_jobs_worker_token(text) to service_role;

-- Define (ou troca) a URL pública do worker. Rodar uma vez por ambiente:
--   select public.configure_jobs_worker('https://SEU-DOMINIO/api/v1/jobs/worker');
-- Passar null desliga as chamadas sem remover o agendamento.
create or replace function public.configure_jobs_worker(p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'jobs_worker_url';
  if p_url is null then
    if v_id is not null then
      delete from vault.secrets where id = v_id;
    end if;
    return;
  end if;
  if p_url !~ '^https://' then
    raise exception 'A URL do worker precisa ser https.';
  end if;
  if v_id is null then
    perform vault.create_secret(p_url, 'jobs_worker_url', 'URL do worker da fila chamada pelo pg_cron');
  else
    perform vault.update_secret(v_id, p_url);
  end if;
end $$;
revoke execute on function public.configure_jobs_worker(text) from public, anon, authenticated;

-- Chamada pelo pg_cron. Não faz nada enquanto a URL não for configurada.
create or replace function public.invoke_jobs_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_token text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'jobs_worker_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'jobs_worker_token';
  if v_url is null or v_token is null then
    return;
  end if;

  perform net.http_get(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_token),
    timeout_milliseconds := 55000
  );
end $$;
revoke execute on function public.invoke_jobs_worker() from public, anon, authenticated;

-- A cada 5 minutos. cron.schedule com o mesmo nome substitui o anterior.
select cron.schedule('finderflow-jobs-worker', '*/5 * * * *', 'select public.invoke_jobs_worker()');
