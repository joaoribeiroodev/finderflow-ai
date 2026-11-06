-- Fase 9 (continuação) — aba "Contratos": cobranças Asaas por organização,
-- usando a chave Asaas da própria organização (nunca a global). Ver
-- docs/DECISIONS.md.
--
-- Diferente do antigo billing da plataforma (assinatura/checkout,
-- removido): aqui a organização é quem cobra os PRÓPRIOS clientes
-- (`companies`), com a própria conta Asaas.

-- Cache de cliente Asaas por empresa — evita recriar o customer na
-- Asaas a cada cobrança (idempotência do lado do app; a Asaas em si não
-- garante isso de forma simples via API pública).
create table public.contract_asaas_customers (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  asaas_customer_id text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, company_id)
);

alter table public.contract_asaas_customers enable row level security;

create policy contract_customers_select_member on public.contract_asaas_customers
  for select to authenticated using (public.is_org_member(organization_id));

-- Escrita feita pela Server Action com o cliente do usuário autenticado
-- (não service role) — por isso precisa de policy de insert/update,
-- restrita a quem pode administrar a org (mesma régua das credenciais
-- Asaas/OpenAI: owner/admin, por ser uma ação financeira).
create policy contract_customers_insert_admin on public.contract_asaas_customers
  for insert to authenticated with check (public.can_admin_org(organization_id));
create policy contract_customers_update_admin on public.contract_asaas_customers
  for update to authenticated using (public.can_admin_org(organization_id)) with check (public.can_admin_org(organization_id));

-- Histórico de cobranças criadas via Asaas. Status não é sincronizado
-- automaticamente (não há webhook por organização ainda — ver
-- docs/DECISIONS.md); `refresh_status` na UI consulta a Asaas e
-- atualiza a linha sob demanda.
create table public.contract_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  asaas_customer_id text not null,
  asaas_charge_id text not null,
  billing_type text not null check (billing_type in ('BOLETO', 'PIX', 'UNDEFINED')),
  status text not null default 'PENDING',
  value numeric(12, 2) not null check (value > 0),
  description text,
  due_date date,
  invoice_url text,
  bank_slip_url text,
  pix_payload text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contract_charges_org_created_idx on public.contract_charges (organization_id, created_at desc);

alter table public.contract_charges enable row level security;

create policy contract_charges_select_member on public.contract_charges
  for select to authenticated using (public.is_org_member(organization_id));
create policy contract_charges_insert_admin on public.contract_charges
  for insert to authenticated with check (public.can_admin_org(organization_id));
create policy contract_charges_update_admin on public.contract_charges
  for update to authenticated using (public.can_admin_org(organization_id)) with check (public.can_admin_org(organization_id));
