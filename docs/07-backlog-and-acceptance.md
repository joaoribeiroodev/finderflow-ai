# 7. Backlog de desenvolvimento e aceite

## 7.1. Priorização

- **P0:** bloqueador do MVP.
- **P1:** importante para primeira versão comercial.
- **P2:** evolução pós-lançamento.

Estimativas não são compromissos de prazo; o tamanho deve ser reavaliado após descoberta técnica.

## 7.2. Épicos e histórias

### EPIC 01 — Fundação e qualidade (P0)

- FF-001 Criar app Next.js + TypeScript strict.
- FF-002 Configurar Tailwind e shadcn/ui.
- FF-003 Configurar Supabase local e cloud.
- FF-004 Configurar lint, formatter, testes e CI.
- FF-005 Implementar schema de env tipado.
- FF-006 Definir migrations e seeds.

**Aceite:** app inicia localmente; lint, typecheck e testes rodam no CI; nenhum segredo versionado.

### EPIC 02 — Auth e multi-tenancy (P0)

- FF-010 Cadastro/login/logout.
- FF-011 Recuperação e verificação de e-mail.
- FF-012 Perfil.
- FF-013 Criar organização e membership owner.
- FF-014 Seletor de organização.
- FF-015 Papéis e convites (convites podem ser P1 se necessário).
- FF-016 RLS de todas as tabelas tenant-scoped.
- FF-017 Teste automatizado de isolamento cross-tenant.

**Aceite:** usuário A não lê, altera, remove nem converte registros de organização B, inclusive forjando IDs na requisição.

### EPIC 03 — Design shell e navegação (P0)

- FF-020 Sidebar responsiva.
- FF-021 Topbar e busca global placeholder.
- FF-022 Tema dark roxo e tokens.
- FF-023 Componentes base e estados de loading/empty/error.
- FF-024 Login e cadastro responsivos.

**Aceite:** navegação consistente e acessível, mobile utilizável, estados visuais definidos.

### EPIC 04 — Empresas e prospecção (P0)

- FF-030 CRUD de empresas.
- FF-031 Cadastro manual.
- FF-032 Importação CSV com preview e validação.
- FF-033 Job assíncrono de importação.
- FF-034 Interface BusinessDataProvider.
- FF-035 Primeiro provedor real autorizado.
- FF-036 Filtros de segmento e localidade.
- FF-037 Normalização e deduplicação.
- FF-038 Histórico de pesquisa e atribuição.
- FF-039 Seleção e conversão em lead.

**Aceite:** buscar/importar empresa, ver fonte e data, selecionar empresa, converter em lead uma única vez e consultar resultado de importação.

### EPIC 05 — CRM (P0)

- FF-040 Pipeline stages por organização.
- FF-041 Listagem de leads com filtros/paginação.
- FF-042 Kanban acessível.
- FF-043 Alterar etapa e registrar histórico.
- FF-044 Detalhe de lead.
- FF-045 Contatos.
- FF-046 Timeline de interações.
- FF-047 Tarefas e lembretes.
- FF-048 Prioridade, score e próxima ação.

**Aceite:** lead transita entre etapas, todas as mudanças importantes são auditadas e timeline é consistente.

### EPIC 06 — OpenAI (P0/P1)

- FF-050 AIProvider e configuração de modelo.
- FF-051 Controle de quota e pré-autorização de uso.
- FF-052 Company Analyzer com Structured Outputs.
- FF-053 Persistência e histórico de análise.
- FF-054 Lead Scorer explicável.
- FF-055 Outreach Generator (somente rascunho).
- FF-056 AiUsageEvents e custo estimado.
- FF-057 Conversas do Copilot.
- FF-058 Function calling com allowlist.
- FF-059 Confirmação humana em operações sensíveis.

**Aceite:** saída validada, falhas tratadas, tokens registrados, chamadas protegidas e nenhum envio externo sem confirmação.

### EPIC 07 — Asaas billing (P0)

- FF-060 Planos e entitlements.
- FF-061 AsaasProvider.
- FF-062 Customer do Asaas.
- FF-063 Checkout recorrente no Sandbox.
- FF-064 Página de retorno (somente informativa).
- FF-065 Webhook autenticado.
- FF-066 Inbox idempotente de eventos.
- FF-067 Sincronizar assinatura e cobrança.
- FF-068 Estados de inadimplência e tolerância.
- FF-069 Cancelamento/alteração do plano.
- FF-070 Tela de billing.

**Aceite:** checkout de Sandbox cria assinatura; webhook duplicado não duplica efeito; retorno sem pagamento não ativa plano; estado sincroniza; secrets não aparecem no browser.

### EPIC 08 — Dashboard e relatórios (P1)

- FF-080 KPIs centralizados.
- FF-081 Funil.
- FF-082 Tendência de leads e receita.
- FF-083 Atividades do dia.
- FF-084 Segmentos e origens.
- FF-085 Insights IA com evidência e período.

**Aceite:** métricas batem com consultas de teste e filtros respeitam timezone/período.

### EPIC 09 — Serviços e propostas (P1)

- FF-090 CRUD de serviços.
- FF-091 Proposta e itens.
- FF-092 Gerar PDF.
- FF-093 Vincular proposta a lead/deal.
- FF-094 Registrar ganho/perda e motivo.

### EPIC 10 — Automações e expansão (P2)

- FF-100 Rules engine simples.
- FF-101 Follow-up baseado em tarefa.
- FF-102 Lead parado.
- FF-103 Notificações.
- FF-104 Pacotes extras de IA.
- FF-105 WhatsApp Business oficial.
- FF-106 Integração de agenda/e-mail.
- FF-107 Asaas do assinante (se houver validação de demanda).

## 7.3. Testes obrigatórios

### Unidade

- schemas Zod;
- normalização/dedupe;
- cálculo de score;
- cálculo de entitlements;
- mapeamento de status Asaas;
- cálculo de métricas.

### Integração

- RLS e membership;
- conversão empresa → lead;
- transação de mudança de etapa;
- persistência de análise IA;
- idempotência webhook;
- job retry/dead-letter.

### E2E

1. Usuário se cadastra, cria organização e acessa dashboard.
2. Importa empresas por CSV.
3. Seleciona empresa e cria lead.
4. Move lead no Kanban e registra interação.
5. Solicita análise IA e gera rascunho de abordagem.
6. Inicia checkout Asaas Sandbox e recebe evento simulado/real de sandbox.
7. Usuário sem plano/limite não consegue consumir recurso pago.
8. Usuário de outro tenant não acessa o recurso por URL/API.

## 7.4. Definition of Done

Uma história só está concluída quando:

- código tipado e formatado;
- validação server-side implementada;
- permissão/RLS testada;
- loading, empty, error e success states;
- logs sem dados secretos;
- testes relevantes passam;
- documentação atualizada;
- integração verificada em Sandbox quando aplicável;
- critérios de aceite demonstrados.

## 7.5. Marcos de entrega

- **M0:** fundação, auth, tenant e RLS.
- **M1:** empresas, CSV, busca e conversão em lead.
- **M2:** CRM, pipeline e atividades.
- **M3:** OpenAI: análise, score e geração de mensagens.
- **M4:** Asaas Sandbox, webhooks e entitlements.
- **M5:** dashboard, proposta, hardening e beta.

## 7.6. Ordem recomendada

Não construir todo o sistema em uma única geração de código. Implementar um marco por vez, testar e revisar migrations. Não avançar de M0 sem testes de isolamento multi-tenant. Não habilitar cobrança real sem validar Sandbox, webhooks, cancelamentos e conciliação.
