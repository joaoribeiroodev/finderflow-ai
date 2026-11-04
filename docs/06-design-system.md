# 6. Design System — FinderFlow AI

## 6.1. Direção de arte

**Conceito:** Dark Mode tecnológico com roxo/violeta como assinatura, combinado com referências de marketing digital, growth, analytics e performance comercial. A interface deve transmitir inteligência, clareza e confiança, sem parecer um painel gamer ou uma tela neon exagerada.

Palavras-chave: premium SaaS, growth marketing, AI copilot, pipeline, insights, dados, gradientes sutis, contraste alto, microinterações discretas.

## 6.2. Paleta sugerida

| Token | Hex | Uso |
|---|---|---|
| `bg-canvas` | `#0B0912` | Fundo principal |
| `bg-sidebar` | `#100D1C` | Sidebar |
| `bg-surface` | `#171326` | Cards e painéis |
| `bg-elevated` | `#211A35` | Popovers/modais |
| `border-subtle` | `#302545` | Bordas |
| `purple-500` | `#8B5CF6` | Ação principal |
| `purple-600` | `#7C3AED` | Hover/active |
| `violet-glow` | `#A78BFA` | Destaques suaves |
| `magenta` | `#D946EF` | Acento de marketing |
| `cyan` | `#22D3EE` | Dados secundários |
| `success` | `#34D399` | Ganho/sucesso |
| `warning` | `#FBBF24` | Atenção |
| `danger` | `#FB7185` | Erro/perda |
| `text-primary` | `#F5F3FF` | Texto principal |
| `text-secondary` | `#B7AEC9` | Texto secundário |
| `text-muted` | `#81778F` | Metadados |

Usar gradientes roxo→magenta em CTAs e elementos de marca, com moderação. Não aplicar brilho em todos os cards. Garantir contraste mínimo compatível com WCAG AA para texto comum.

## 6.3. Tipografia

- Preferida: Inter ou Geist Sans.
- Títulos: 600/700, tracking levemente negativo.
- Corpo: 400/500, line-height 1.45–1.6.
- Números de KPI: 600/700 com `font-variant-numeric: tabular-nums`.
- Escala sugerida: 12, 14, 16, 20, 24, 30, 36 px.

## 6.4. Layout e navegação

- Sidebar fixa (240–260 px) em desktop, recolhível.
- Topbar com busca global, notificações, seletor de organização e perfil.
- Conteúdo com largura fluida e padding 24–32 px.
- Grid de 12 colunas ou CSS grid responsivo.
- Cards com radius 14–18 px.
- Bordas sutis; sombras suaves e luz ambiente localizada.
- Mobile: sidebar vira drawer e tabelas se convertem em cards ou rolagem controlada.

## 6.5. Componentes

- `AppSidebar`, `Topbar`, `PageHeader`, `KpiCard`, `ChartCard`.
- `SearchFilters`, `CompanyResultTable`, `SourceBadge`, `CompanyDrawer`.
- `LeadKanbanBoard`, `LeadCard`, `StageColumn`, `LeadDetailDrawer`.
- `ActivityTimeline`, `TaskList`, `FollowUpBanner`.
- `AIInsightCard`, `AIScoreBadge`, `CopilotPanel`, `PromptSuggestion`.
- `PlanCard`, `UsageMeter`, `BillingHistoryTable`.
- `EmptyState`, `LoadingSkeleton`, `ErrorState`, `ConfirmDialog`, `Toast`.

## 6.6. Telas de referência obrigatórias

1. Login/cadastro: marca, formulário central, destaque visual roxo.
2. Dashboard: boas-vindas, filtro de período, 4 KPIs, gráfico de receita, funil, atividades e AI insight.
3. Prospecção: filtros de segmento/estado/cidade/presença digital; tabela com checkbox, fonte e ação adicionar leads.
4. Empresas: perfil empresarial com dados e análise.
5. Leads: Kanban com etapas, cards e filtros.
6. Detalhe do lead: resumo, score, empresa, contatos, timeline, tarefas e propostas.
7. AI Copilot: conversa, contexto do CRM, sugestões rápidas e resultados de ferramentas.
8. Serviços/propostas: catálogo e construtor de proposta.
9. Billing: plano atual, consumo, checkout, cobranças e status.
10. Configurações: organização, membros, integrações, preferências e segurança.

## 6.7. Microinterações

- Hover com alteração sutil de borda e fundo.
- Transições de 150–220 ms.
- Feedback imediato ao salvar, mover lead ou gerar análise.
- Skeleton para carregamento; não deixar tela vazia.
- Indicador de fonte de dados e horário da última atualização.
- Drag-and-drop de Kanban acessível também por menu/teclado.
- Respeitar `prefers-reduced-motion`.

## 6.8. Referências visuais incluídas

- `assets/ui-reference-collage.png`: dashboard, prospecção, Kanban e Copilot.
- `prototype/index.html`: protótipo navegável das principais telas, dados ilustrativos, sem backend.

## 6.9. Critério visual

Não copiar literalmente dashboards genéricos. Manter identidade FinderFlow AI, hierarquia forte, roxo tecnológico e acentos de growth marketing. Priorizar leitura de dados e tarefas do dia. Evitar gradientes fortes sob texto pequeno, excesso de bordas, texto com baixo contraste e gráficos sem legenda.
