-- Remove as FKs simples (coluna única) redundantes com as FKs compostas
-- "same org" já existentes no schema de referência. Cada par abaixo
-- referenciava a mesma tabela com o MESMO comportamento de ON DELETE — a
-- FK composta é estritamente mais forte (também exige organization_id
-- igual) e já cobre a integridade referencial sozinha.
--
-- A FK simples sobrando fazia o PostgREST recusar qualquer embed entre as
-- duas tabelas com o erro "more than one relationship was found", quebrando
-- qualquer `select` com join aninhado (ex.: leads -> companies). Descoberto
-- via QA visual real do dashboard da Fase 2 (tela em branco em produção) e
-- confirmado consultando pg_constraint diretamente no projeto real
-- (lxzsefabmnagiaywaxeb). Aplicado ao vivo como `drop_redundant_simple_fks`.
alter table public.company_source_refs drop constraint company_source_refs_company_id_fkey;
alter table public.contacts drop constraint contacts_company_id_fkey;
alter table public.deals drop constraint deals_lead_id_fkey;
alter table public.interactions drop constraint interactions_lead_id_fkey;
alter table public.lead_stage_history drop constraint lead_stage_history_lead_id_fkey;
alter table public.leads drop constraint leads_company_id_fkey;
alter table public.proposals drop constraint proposals_lead_id_fkey;
alter table public.tasks drop constraint tasks_lead_id_fkey;
