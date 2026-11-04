-- Fase 5 (Copilot): encadeamos turnos da mesma conversa usando
-- `previous_response_id` da Responses API (em vez de reconstruir o
-- histórico de mensagens/function_call items manualmente a cada turno,
-- o que exigiria replicar exatamente o formato interno de items da API).
-- Isto guarda o id da última resposta do modelo nesta conversa.

alter table public.ai_conversations
  add column if not exists last_response_id text;
