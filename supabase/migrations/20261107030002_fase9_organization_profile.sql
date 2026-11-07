-- Fase 9: "Perfil" da organização em Configurações — dados cadastrais
-- (pessoa jurídica ou física) usados para personalizar a prospecção por
-- IA: identificar quem está vendendo, o que vende (pitch) e, sobretudo,
-- o WhatsApp para a IA sempre sugerir levar a conversa de e-mail para lá
-- (é dado não sensível — sem Vault, mesmo padrão simples de `services`).

create table public.organization_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  person_type text not null default 'company' check (person_type in ('company', 'individual')),
  legal_name text,
  trade_name text,
  document text,
  sender_name text,
  email text,
  phone text,
  whatsapp_number text,
  website text,
  address_city text,
  address_state text,
  pitch text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_profiles enable row level security;

create policy organization_profiles_select_member on public.organization_profiles
  for select to authenticated using (public.is_org_member(organization_id));
create policy organization_profiles_insert_editor on public.organization_profiles
  for insert to authenticated with check (public.can_edit_org(organization_id));
create policy organization_profiles_update_editor on public.organization_profiles
  for update to authenticated using (public.can_edit_org(organization_id)) with check (public.can_edit_org(organization_id));
create policy organization_profiles_delete_admin on public.organization_profiles
  for delete to authenticated using (public.can_admin_org(organization_id));
