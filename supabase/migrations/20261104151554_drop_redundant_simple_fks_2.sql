-- Continuação da limpeza de FKs simples redundantes (mesmo padrão e mesmo
-- motivo da migration anterior), encontradas por uma auditoria completa do
-- schema via pg_constraint depois do primeiro achado. Aplicado ao vivo como
-- `drop_redundant_simple_fks_2`.
alter table public.leads drop constraint leads_stage_id_fkey;
alter table public.search_results drop constraint search_results_search_id_fkey;
alter table public.lead_stage_history drop constraint lead_stage_history_from_stage_id_fkey;
alter table public.lead_stage_history drop constraint lead_stage_history_to_stage_id_fkey;
alter table public.proposal_items drop constraint proposal_items_proposal_id_fkey;
alter table public.ai_messages drop constraint ai_messages_conversation_id_fkey;
alter table public.billing_payments drop constraint billing_payments_subscription_id_fkey;
