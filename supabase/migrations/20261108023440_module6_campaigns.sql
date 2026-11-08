-- Módulo 6 — Campanhas de Vendas (ETAPA-0-AUDITORIA.md §9 item 7).
--
-- Depende criticamente do item 1 (supressão/LGPD) já estar pronto — e
-- está: `suppression_entries` + `is_contact_suppressed` (Fase 10). A
-- seção 6 da auditoria também aponta uma decisão de negócio pendente
-- ("texto padrão de descadastro") que eu NÃO devo inferir sozinho. A
-- solução adotada aqui não inventa um texto — torna o texto de
-- descadastro uma configuração OBRIGATÓRIA por organização
-- (`organization_profiles.unsubscribe_text`): cada organização escreve o
-- seu próprio texto (a pergunta de negócio original nem fazia sentido
-- como resposta única, já que cada organização é um negócio diferente);
-- o backend bloqueia o envio de campanha enquanto esse campo estiver
-- vazio. "Prazo de retenção de mensagens" fica deliberadamente sem purga
-- automática por agora (mesmo estado de toda outra tabela deste schema
-- hoje) — reportado como pendência explícita, não uma decisão silenciosa.

alter table public.organization_profiles
  add column unsubscribe_text text;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  objective text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index campaigns_org_created_idx on public.campaigns(organization_id, created_at desc);

create table public.campaign_companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'selected' check (status in ('selected', 'excluded', 'contacted', 'responded')),
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (campaign_id, company_id),
  constraint campaign_companies_campaign_same_org_fk foreign key (organization_id, campaign_id)
    references public.campaigns(organization_id, id) on delete cascade,
  constraint campaign_companies_company_same_org_fk foreign key (organization_id, company_id)
    references public.companies(organization_id, id) on delete cascade
);
create index campaign_companies_campaign_idx on public.campaign_companies(campaign_id);
create index campaign_companies_company_idx on public.campaign_companies(organization_id, company_id);

-- Uma linha por empresa-na-campanha: acompanha o ciclo de vida da única
-- mensagem daquela combinação campanha+empresa (rascunho → aprovação →
-- envio), nunca um histórico de múltiplas mensagens — "quem aprovou" e
-- "status de envio" são por definição singulares aqui (audit §7).
create table public.campaign_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_company_id uuid not null references public.campaign_companies(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email')),
  recipient_email text,
  subject text,
  body text,
  rendered_body text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'failed')),
  generated_by_ai boolean not null default false,
  model text,
  prompt_version text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_company_id),
  constraint campaign_messages_campaign_same_org_fk foreign key (organization_id, campaign_id)
    references public.campaigns(organization_id, id) on delete cascade,
  constraint campaign_messages_campaign_company_same_org_fk foreign key (organization_id, campaign_company_id)
    references public.campaign_companies(organization_id, id) on delete cascade
);
create index campaign_messages_campaign_idx on public.campaign_messages(campaign_id);

alter table public.campaigns enable row level security;
alter table public.campaign_companies enable row level security;
alter table public.campaign_messages enable row level security;

create policy campaigns_select_member on public.campaigns
  for select to authenticated using (public.is_org_member(organization_id));
create policy campaigns_insert_editor on public.campaigns
  for insert to authenticated with check (public.can_edit_org(organization_id));
create policy campaigns_update_editor on public.campaigns
  for update to authenticated using (public.can_edit_org(organization_id)) with check (public.can_edit_org(organization_id));
create policy campaigns_delete_admin on public.campaigns
  for delete to authenticated using (public.can_admin_org(organization_id));

create policy campaign_companies_select_member on public.campaign_companies
  for select to authenticated using (public.is_org_member(organization_id));
create policy campaign_companies_insert_editor on public.campaign_companies
  for insert to authenticated with check (public.can_edit_org(organization_id));
create policy campaign_companies_update_editor on public.campaign_companies
  for update to authenticated using (public.can_edit_org(organization_id)) with check (public.can_edit_org(organization_id));
create policy campaign_companies_delete_editor on public.campaign_companies
  for delete to authenticated using (public.can_edit_org(organization_id));

create policy campaign_messages_select_member on public.campaign_messages
  for select to authenticated using (public.is_org_member(organization_id));
create policy campaign_messages_insert_editor on public.campaign_messages
  for insert to authenticated with check (public.can_edit_org(organization_id));
-- Update inclui a transição de aprovação/envio — mas nunca delete (trilha
-- de auditoria de o que foi de fato aprovado/enviado nunca é apagável).
create policy campaign_messages_update_editor on public.campaign_messages
  for update to authenticated using (public.can_edit_org(organization_id)) with check (public.can_edit_org(organization_id));
