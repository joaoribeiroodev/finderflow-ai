# 1. Documento de Requisitos do Produto (PRD)

## 1.1. Resumo executivo

O **FinderFlow AI** é uma plataforma SaaS multi-tenant que ajuda profissionais e pequenas empresas B2B a descobrir empresas, avaliar oportunidades comerciais, organizar leads, preparar abordagens, acompanhar negociações e analisar resultados. A plataforma combina um CRM leve, uma central de prospecção com fontes híbridas de dados e um motor de IA baseado na OpenAI API. As assinaturas do próprio FinderFlow serão cobradas pelo Asaas.

**Proposta de valor:** transformar a prospecção B2B em um processo organizado, assistido por IA, mensurável e repetível.

## 1.2. Problema

A prospecção costuma estar fragmentada entre buscadores, diretórios, planilhas, WhatsApp, e-mail e ferramentas de CRM. O usuário perde tempo encontrando empresas, avaliando presença digital, criando mensagens e lembrando quando retomar uma conversa. O FinderFlow centraliza esse fluxo, preservando a decisão humana em ações comerciais sensíveis.

## 1.3. Objetivos

1. Diminuir o tempo de descoberta e triagem de empresas.
2. Aumentar a qualidade e rastreabilidade da qualificação comercial.
3. Centralizar empresas, leads, contatos, atividades, propostas e negócios.
4. Utilizar IA para análise, priorização e preparação de comunicações.
5. Automatizar tarefas e lembretes sem disparo indiscriminado de mensagens.
6. Monetizar o produto com planos e assinaturas recorrentes via Asaas.
7. Preparar arquitetura e segurança para múltiplas organizações e equipes.

## 1.4. Não objetivos do MVP

- Envio em massa ou automação não solicitada de mensagens.
- Scraping indiscriminado de Google Maps, Instagram, LinkedIn ou outros serviços.
- Sistema fiscal/contábil completo.
- Gestão de projetos de software dos clientes finais.
- Marketplace de freelancers.
- Aplicativo mobile nativo.
- Processamento de pagamentos dos clientes dos assinantes. No MVP, o Asaas cobra apenas a assinatura do FinderFlow.

## 1.5. Público-alvo e personas

### Persona A — profissional autônomo

Precisa encontrar empresas e vender serviços com pouco tempo e orçamento. Quer pesquisar segmentos e cidades, salvar leads e receber ajuda para abordar cada oportunidade.

### Persona B — agência ou pequena software house

Possui mais de um vendedor ou responsável comercial, precisa distribuir leads, acompanhar pipeline, padronizar propostas e medir conversão.

### Persona C — consultoria/serviços B2B

Vende serviços configuráveis (marketing, automação, design, tecnologia ou consultoria) e precisa descobrir empresas que tenham aderência ao portfólio.

## 1.6. Princípios do produto

- **Empresa encontrada não é automaticamente lead.** Uma empresa só entra no CRM quando o usuário decide convertê-la.
- **Fatos separados de hipóteses.** A IA deve indicar evidências, origem e confiança, sem apresentar inferências como fatos.
- **Humano no controle.** Mensagens e propostas geradas por IA precisam de revisão; ações externas exigem autorização explícita.
- **Privacidade por organização.** Todos os dados de negócio são isolados por `organization_id` e RLS.
- **Provedor substituível.** Aquisição de dados, IA e pagamentos devem ter adaptadores próprios.
- **MVP enxuto.** Monólito modular antes de microserviços.

## 1.7. Módulos funcionais

### MOD-01 — Autenticação e organizações

Cadastro, login, recuperação de senha, verificação de e-mail, perfil, criação de organização, convites e papéis. Papéis iniciais: `owner`, `admin`, `manager`, `member`, `viewer`.

### MOD-02 — Dashboard

Cards de empresas encontradas, leads ativos, leads qualificados, contatos realizados, propostas enviadas, negócios ganhos, conversão, pipeline ponderado e receita conquistada. Exibir evolução por período, funil, distribuição por segmento, tarefas pendentes, leads parados e resumo de IA. Diferenciar receita contratada, faturada e recebida.

### MOD-03 — Central de prospecção

Pesquisa por segmento, termo, estado, cidade e filtros suportados pela fonte. Exibir empresa, categoria, endereço, telefone, website, redes sociais, avaliação e fonte, quando fornecidos legalmente. Suportar resultados paginados, seleção simples/múltipla, pesquisas salvas, histórico, exportação permitida, importação CSV e cadastro manual. Mostrar data da consulta e limitações da fonte.

### MOD-04 — Empresas e CRM

Cadastro e detalhes da empresa; conversão explícita em lead; deduplicação; pipeline Kanban e tabela; responsáveis; prioridade; serviço de interesse; valor estimado; probabilidade; próxima ação; timeline de interações; tarefas e notas; motivos de perda; reabertura controlada.

Etapas padrão: Novo, Qualificação, Preparar abordagem, Contatado, Em conversa, Reunião agendada, Proposta enviada, Negociação, Ganho e Perdido. As etapas devem ser configuráveis por organização.

### MOD-05 — AI Engine

- Company Analyzer: análise de presença e contexto empresarial.
- Lead Scorer: score explicável de 0 a 100.
- Opportunity Engine: sugestão de serviço aderente.
- Outreach Generator: rascunhos de abordagem por canal e tom.
- Follow-up Assistant: sugestão de próximo contato.
- Proposal Assistant: rascunho de escopo e proposta.
- Sales Analyst: interpretação de métricas.
- CRM Copilot: assistente conversacional com ferramentas internas autorizadas.

### MOD-06 — Atividades e relacionamento

Tarefas, lembretes, interações, reuniões, notas, canais de contato, histórico e notificações. Uma interação deve registrar autor, data/hora, canal, tipo e descrição. Não armazenar conteúdo excessivo ou sensível sem finalidade.

### MOD-07 — Serviços, propostas e negócios

Catálogo de serviços configurável, preços e modelos de precificação; propostas com itens, validade, status e PDF; negócios vinculados a leads e propostas; status ganho/perdido; valores previstos e efetivos. Os valores registrados pelo usuário não são cobranças do FinderFlow.

### MOD-08 — Automações

Gatilhos internos: lead criado, score atualizado, etapa alterada, tarefa vencida, proposta enviada, negócio ganho/perdido. Ações: criar tarefa, notificar, solicitar análise IA e atualizar campos permitidos. Regras precisam ser auditáveis, limitadas por plano e possuir prevenção de loops.

### MOD-09 — Relatórios

Conversão por período, segmento, serviço, origem, responsável e etapa; tempo médio de ciclo; ticket médio; motivo de perda; produtividade e consumo de IA.

### MOD-10 — Billing e gestão SaaS

Planos, checkout recorrente, assinatura, pagamentos, inadimplência, período de tolerância, cancelamento, upgrade/downgrade, limites e histórico financeiro do assinante via Asaas. O status da assinatura é atualizado por webhook autenticado e idempotente; não pelo retorno de navegador.

## 1.8. Requisitos funcionais numerados

| ID | Requisito | Prioridade |
|---|---|---|
| RF-001 | Cadastrar, autenticar e recuperar conta | P0 |
| RF-002 | Criar organização e vincular membros | P0 |
| RF-003 | Aplicar papéis e permissões | P0 |
| RF-004 | Isolar dados por organização com RLS | P0 |
| RF-005 | Consultar dashboard por período | P1 |
| RF-006 | Pesquisar empresas por segmento e localidade | P0 |
| RF-007 | Importar empresas por CSV | P0 |
| RF-008 | Cadastrar empresa manualmente | P0 |
| RF-009 | Normalizar e deduplicar empresas | P0 |
| RF-010 | Guardar pesquisas e resultados permitidos | P0 |
| RF-011 | Converter empresa selecionada em lead | P0 |
| RF-012 | Visualizar leads em Kanban e tabela | P0 |
| RF-013 | Criar/editar etapas do pipeline | P1 |
| RF-014 | Registrar contatos e interações | P0 |
| RF-015 | Criar tarefas e lembretes | P0 |
| RF-016 | Analisar empresa com OpenAI | P0 |
| RF-017 | Gerar score explicável | P0 |
| RF-018 | Gerar rascunho de abordagem | P0 |
| RF-019 | Conversar com CRM Copilot | P1 |
| RF-020 | Executar ferramentas do assistente com autorização | P1 |
| RF-021 | Cadastrar serviços | P1 |
| RF-022 | Criar propostas e negócios | P1 |
| RF-023 | Contratar plano via Asaas | P0 |
| RF-024 | Receber e processar webhook Asaas | P0 |
| RF-025 | Controlar limites e consumo por plano | P0 |
| RF-026 | Consultar histórico de pagamentos | P1 |
| RF-027 | Registrar logs de auditoria | P0 |
| RF-028 | Exportar dados da organização | P1 |
| RF-029 | Registrar origem, licença e data da fonte | P0 |
| RF-030 | Gerenciar lista de supressão/oposição a contato | P1 |

## 1.9. Requisitos não funcionais

- Responsividade para desktop, tablet e celular.
- Acessibilidade: navegação por teclado, contraste adequado, labels e estados de foco.
- Segurança: RLS, RBAC, validação de entrada, rate limiting e gestão de segredos.
- Disponibilidade: tratamento de falhas externas e degradação graciosa.
- Performance: paginação no servidor; evitar carregar listas completas; índices de filtros.
- Observabilidade: logs estruturados, correlation IDs e monitoramento de tarefas.
- Manutenibilidade: TypeScript estrito, módulos, testes e documentação.
- Integridade: transações para operações comerciais críticas e idempotência para webhooks.
- Privacidade: minimização, retenção, exportação e exclusão conforme política.

## 1.10. Regras de negócio

1. Um resultado de pesquisa só vira lead após ação explícita do usuário.
2. Uma organização não acessa registros de outra organização.
3. Um lead pertence a uma organização e referencia uma empresa dessa organização.
4. Deve existir no máximo um lead ativo por empresa e organização; casos de duplicidade devem permitir revisão/reabertura controlada.
5. Mudança de etapa gera evento de histórico.
6. Ganho/perda exige registro de encerramento e, quando perdido, motivo recomendado.
7. Score não equivale à probabilidade de compra. Probabilidade comercial é campo separado e editável.
8. Toda análise IA registra modelo, versão de prompt, fontes, uso e resultado.
9. Comunicação gerada pela IA é rascunho até aprovação humana.
10. A assinatura do FinderFlow só muda após confirmação verificada do provedor ou ação administrativa auditada.
11. Webhooks podem ser recebidos mais de uma vez; processar de forma idempotente.
12. Limites são verificados no backend, antes de consumir APIs pagas.
13. Dados externos só são armazenados pelo período e forma permitidos pelo provedor.
14. Solicitações de não contato devem ser respeitadas e aplicadas em toda futura campanha/abordagem.

## 1.11. Métricas de sucesso do produto

- Tempo mediano entre pesquisa e criação de lead.
- Percentual de resultados convertidos em leads.
- Percentual de leads que recebem primeiro contato.
- Taxa de resposta por canal (quando registrada).
- Conversão de lead em negócio ganho.
- Tempo médio até fechamento.
- Custo de IA por organização e por tarefa.
- Custo de dados por pesquisa e por lead convertido.
- Retenção, churn e receita recorrente do FinderFlow.

## 1.12. Critérios de aceite do MVP

O MVP é aceito quando: (a) cadastro/login e organização funcionam; (b) RLS impede leitura cruzada; (c) cadastro manual e CSV funcionam; (d) existe ao menos um provedor real de pesquisa integrado e validado; (e) empresa pode virar lead sem duplicar; (f) pipeline e timeline funcionam; (g) análise e mensagem IA são persistidas; (h) plano e checkout de teste funcionam em Asaas Sandbox; (i) webhook autenticado e idempotente atualiza assinatura; (j) limites de plano são verificados no servidor; (k) testes automatizados cobrem os fluxos críticos.
