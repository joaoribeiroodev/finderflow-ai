-- Fase 5 (Copilot): ferramentas que mutam dados (create_task,
-- update_lead_stage) exigem confirmação explícita do usuário antes de
-- executar (docs/05-integrations.md §5.1 — "Operações externas, envio de
-- mensagem, exclusão e mudanças de alto impacto requerem confirmação
-- explícita do usuário"). A chamada pendente é persistida no SERVIDOR
-- (nesta coluna), nunca confiada a partir de um payload reenviado pelo
-- cliente — a action de confirmação relê esta coluna em vez de aceitar
-- argumentos arbitrários do form de confirmação. Ver DECISIONS.md.

alter table public.ai_conversations
  add column if not exists pending_tool_call jsonb;
