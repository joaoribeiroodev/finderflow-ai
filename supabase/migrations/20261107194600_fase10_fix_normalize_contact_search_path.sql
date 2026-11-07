-- Corrige o advisor "Function Search Path Mutable" em normalize_contact_value
-- (esquecido na migration anterior) — fixar search_path é a defesa contra
-- um search_path malicioso injetado via sessão/role, mesmo em função sql
-- imutável que não acessa tabelas.
create or replace function public.normalize_contact_value(p_type text, p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_type = 'email' then lower(trim(p_value))
    else regexp_replace(p_value, '\D', '', 'g')
  end;
$$;
