# FinderFlow AI

SaaS multi-tenant de prospecção B2B, CRM e inteligência comercial com IA.

> Status: **Fase 8 concluída** (fundação → hardening) — ver a ressalva
> explícita sobre não estar pronto para produção/beta comercial abaixo,
> com isolamento RLS verificado contra um projeto Supabase real
> (`lxzsefabmnagiaywaxeb`, org `joaoribeiroodev`, região `sa-east-1`).
> Consulte `docs/07-backlog-and-acceptance.md` para o backlog completo e
> `docs/DECISIONS.md` para decisões técnicas e pendências.

## Stack

- Next.js 16 (App Router) + TypeScript strict
- Tailwind CSS
- Supabase (PostgreSQL + Auth + RLS), via `@supabase/ssr`
- Zod (validação) + React Hook Form
- Vitest (unitário) + Playwright (E2E)

## Pré-requisitos

- Node.js 22+
- Docker (para o stack local do Supabase via CLI)

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env.local` e preencha as variáveis
   (ver seção "Variáveis de ambiente" abaixo). Para desenvolvimento, as
   credenciais do Supabase podem vir do stack local:

   ```bash
   npm run supabase:start
   # imprime a URL local e as chaves anon/service_role
   ```

3. Aplique as migrations no banco (local ou projeto Supabase):

   ```bash
   npm run supabase:reset   # recria o banco local a partir de supabase/migrations
   ```

4. Rode o app:

   ```bash
   npm run dev
   ```

   Acesse http://localhost:3000 — você será redirecionado para `/login`.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Testes unitários (Vitest) |
| `npm run test:rls` | Testes de integração de isolamento cross-tenant (requer Supabase local rodando — ver abaixo) |
| `npm run test:e2e` | Testes E2E (Playwright) |
| `npm run verify` | lint + typecheck + test |
| `npm run supabase:start` / `:stop` / `:reset` | Stack local do Supabase (Docker) |

## Variáveis de ambiente

Ver `.env.example`. Resumo:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: públicas,
  usadas no browser e no servidor.
- `SUPABASE_SERVICE_ROLE_KEY`: **somente servidor**. Nunca expor no bundle do
  cliente, logs ou exemplos com valor real.
- `OPENAI_API_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `BUSINESS_PROVIDER_API_KEY`,
  `CRON_SECRET`: **somente servidor**, usados a partir da Fase 5/6/3.
- `BUSINESS_PROVIDER=minha_receita`: habilita o primeiro provedor real de
  busca de empresas (base de CNPJ da Receita Federal via a API pública
  Minha Receita — minhareceita.org), sem exigir `BUSINESS_PROVIDER_API_KEY`
  (ver `docs/DECISIONS.md`). `BUSINESS_PROVIDER_BASE_URL` (opcional) aponta
  para uma instância auto-hospedada do mesmo projeto (open-source, MIT).
- `BRAVE_SEARCH_API_KEY`: habilita a verificação de presença digital
  ("essa empresa tem site?") via a Brave Search API (2.000 req/mês
  gratuitas) — o sinal central de prospecção do produto. Sem ela, o
  botão "Verificar site" mostra um estado honesto de "não configurado".
- `TEST_SUPABASE_URL` / `TEST_SUPABASE_SERVICE_ROLE_KEY`: usados apenas pelo
  teste de integração de RLS (`npm run test:rls`), nunca em produção.

Se uma chave estiver ausente, o módulo correspondente permanece desabilitado
(`isOpenAiConfigured()`, `isAsaasConfigured()`, `isBusinessProviderConfigured()`
em `src/lib/env/env.server.ts`) em vez de quebrar o build — a interface do
provider existe, mas a chamada real só ocorre quando configurada.

`POST /api/v1/jobs/billing-sync` (protegido por `Authorization: Bearer
$CRON_SECRET`) reconcilia assinaturas periodicamente (ver docs/DECISIONS.md,
Fase 6) — **não há agendador configurado neste ambiente**; em produção,
chame-o periodicamente via Vercel Cron, GitHub Actions ou similar.

## Testes de isolamento cross-tenant (RLS)

`tests/integration/rls-cross-tenant.test.ts` cria dois usuários em duas
organizações distintas e confirma que nenhum lê ou grava dados do outro,
usando apenas a API pública (nunca a service role). Requer um Supabase
local (`npm run supabase:start`, precisa de Docker) ou a
`SUPABASE_SERVICE_ROLE_KEY` de um projeto de desenvolvimento dedicado.

✅ O isolamento RLS **já foi verificado** contra o projeto Supabase real
(`lxzsefabmnagiaywaxeb`) — ver `supabase/tests/rls-cross-tenant-verification.sql`
(roda via SQL direto, sem precisar da service_role key) e o resultado em
`docs/DECISIONS.md`. O teste de integração em Vitest continua sendo a forma
preferida para rodar localmente contra a stack HTTP/PostgREST real; para
isso, preencha `TEST_SUPABASE_SERVICE_ROLE_KEY` em `.env.local` (chave obtida
em Project Settings → API no dashboard do Supabase).

## Estrutura do projeto

```text
src/
  app/            rotas (App Router): (auth) e (workspace)
  components/     componentes de UI
  modules/        regras de negócio por domínio (auth, organizations, ...)
  lib/            supabase, validação (Zod), permissões, env, logger
  types/          tipos do banco (database.ts)
supabase/
  migrations/     migrations versionadas
  tests/          scripts SQL de verificação (ex.: isolamento RLS, sem depender da service_role key)
docs/             especificação do produto (requisitos, arquitetura, etc.)
tests/integration/  testes de integração (RLS)
```

## Status das fases

- ✅ Fase 0/1 — fundação, auth, multi-tenant, RLS verificado.
- ✅ Fase 2 — shell visual (sidebar/topbar/design tokens), dashboard com dados reais (sem fixtures), página de Configurações, páginas das próximas fases como "em construção". Dois bugs críticos de produção encontrados via QA visual real e corrigidos (Cache Components quebrando `/dashboard` e `/settings`; FKs redundantes quebrando embeds do PostgREST) — detalhes em `docs/DECISIONS.md`.
- ✅ Fase 3 — empresas (CRUD, busca/filtro/paginação), cadastro manual, importação CSV (upload → mapeamento → preview/validação → confirmação, com `import_jobs` auditável), deduplicação conservadora (CNPJ bloqueia, domínio avisa, nome nunca sozinho), conversão empresa→lead, contrato `BusinessDataProvider` pronto mas sem adaptador real (decisão de provedor ainda pendente — `/prospecting` expõe isso honestamente). Dois bugs de produção encontrados via QA visual real e corrigidos (um `redirect()` do Next.js dentro de `try/catch` engolindo o próprio redirecionamento; validação Zod rejeitando `null` de um checkbox ausente do DOM) — detalhes em `docs/DECISIONS.md`.
- ✅ Fase 4 — CRM: etapas de funil configuráveis (criar/renomear/recolorir/excluir/reordenar), lista de leads com busca/filtro/paginação, Kanban (seletor de etapa acessível por teclado em vez de drag-and-drop), detalhe do lead (prioridade, valor estimado, probabilidade, próximo contato), contatos, timeline de interações, tarefas, histórico de mudança de etapa gravado atomicamente via RPC no banco. Um achado de segurança (`anon` podia executar RPCs sensíveis via PostgREST) e um bug de produção (interação não registrava, sem erro visível — mesma classe do bug de checkbox da Fase 3) encontrados e corrigidos antes do commit — detalhes em `docs/DECISIONS.md`.
- ✅ Fase 5 — IA (OpenAI): `AIProvider`/`OpenAIProvider` via Responses API com Structured Outputs (revalidados com Zod), quota mensal por organização verificada antes de cada chamada, registro de uso (modelo/prompt/tokens/custo/duração/status) em `ai_usage_events`. Company Analyzer, Lead Scorer (pesos fixos 25/25/15/15/10/10, nunca chamado de "probabilidade de compra") e Outreach Generator, todos com estado honesto de "IA não configurada" quando `OPENAI_API_KEY` está ausente. Copilot conversacional com allowlist de ferramentas (sem SQL/credenciais para o modelo), confirmação explícita do usuário para ações que alteram dados (persistida no servidor, nunca confiada do cliente), e sanitização de dado de terceiros contra prompt injection. QA real em build de produção confirmou os zero-states honestos (sem chave configurada neste ambiente) — detalhes e decisões (quota placeholder, preços estimados, encadeamento via `previous_response_id`) em `docs/DECISIONS.md`.
- ✅ Fase 6 — Billing (Asaas): `AsaasProvider` real sobre a API v3 (customer, checkout recorrente, consulta de assinatura) + `NotConfiguredAsaasProvider`; checkout hospedado com preço sempre calculado no servidor a partir de `plans`; webhook idempotente (`/api/v1/webhooks/asaas`, reivindicação atômica por evento — retries nunca duplicam efeito); página de retorno puramente informativa (nunca confirma pagamento); sincronização de status combinando assinatura+pagamento; tolerância de inadimplência configurável antes de restringir IA sem apagar dados; job de reconciliação periódica (`/api/v1/jobs/billing-sync`, requer scheduler externo — não configurado neste ambiente). Fecha o placeholder de quota de IA da Fase 5: o limite mensal passa a vir do plano contratado. Um bug crítico (middleware redirecionando as próprias rotas de webhook/job para `/login`) foi encontrado pelo QA real de build de produção e corrigido antes do commit — detalhes em `docs/DECISIONS.md`.
- ✅ Fase 7 — Serviços (catálogo CRUD, nunca excluído — só desativado), Propostas + itens (numeração sequencial por org, total sempre recalculado por gatilho de banco — nunca pela aplicação, PDF via `pdfkit` enviado a um bucket privado do Supabase Storage, estados `draft→sent→accepted/rejected/expired`), Negócios (`deals`) ligados 1:1 a uma proposta aceita com ganho/perda+motivo, Dashboard com tendência de leads/receita, segmentos/origens e "Insights IA" (Sales Analyst — a IA só interpreta números já calculados pelo servidor, nunca calcula os seus próprios), Relatórios (conversão por segmento/origem/responsável/etapa/serviço, ciclo médio, ticket médio, motivos de perda, consumo de IA — uma única função testada define a taxa de conversão em todos os casos), Proposal Assistant (IA) no detalhe do lead (gera um rascunho revisável, nunca insere a proposta diretamente). O Opportunity Engine da Fase 5 passou a funcionar ponta a ponta sem nenhum código novo, só precisava de um catálogo de serviços real. Um bug (`proposalsSentCount` do dashboard contando todas as propostas, não só as enviadas) foi corrigido antes do commit; QA real em build de produção (17 verificações) passou limpo — detalhes em `docs/DECISIONS.md`.
- ✅ Fase 8 — Hardening: teste de isolamento cross-tenant ao vivo (dois tenants reais, 13/13 tentativas de acesso cruzado bloqueadas pela RLS — select/update/delete/insert e acesso anônimo), revisão de RLS tabela a tabela (nenhum gap), 18 índices de performance novos + merge de policies duplicadas no `profiles`, headers de segurança (CSP/HSTS/X-Frame-Options/etc.) e rate limiting best-effort no middleware (testado: 429 após o limite), logging estruturado com redação automática de PII/segredos (não depende mais só de disciplina do desenvolvedor) e logs operacionais nos pontos que faltavam (webhook, job de reconciliação, chamadas de IA), auditoria de acessibilidade real (axe-core) nas 13 páginas autenticadas principais — 16 violações críticas/sérias encontradas e corrigidas (contraste de cor, `<select>` sem rótulo, `<dl>` malformado, cor de etapa do pipeline usada como cor de texto), 0 overflow horizontal em mobile (375px). Regressão dos fluxos de billing da Fase 6 confirmada intocada. **Não declaramos o sistema pronto para produção/beta comercial** — o checklist completo com o que falta (domínio, backups — plano Supabase atual é Free e não tem backup gerenciado —, termos revisados juridicamente, provedor de dados definido) está em `docs/DECISIONS.md`, Fase 8.
- ✅ Pós-Fase 8 — Primeiro provedor real de busca de empresas: `MinhaReceitaProvider` (`BUSINESS_PROVIDER=minha_receita`) busca na base pública de CNPJ da Receita Federal via a API comunitária Minha Receita (minhareceita.org, MIT, gratuita), por UF/cidade e CNAE, com um catálogo de ~20 segmentos comuns conferidos ao vivo contra a API (nunca "de memória") e uma IA que só escolhe entre esses segmentos já catalogados — nunca inventa um código novo. Resultados vão para `search_results` e só viram `companies` com um clique explícito ("Adicionar como empresa"), com atribuição sempre visível. Resolve a decisão pendente #1 só para **descoberta** — enriquecimento (site/contato real do decisor) continua pendente e é um passo distinto; detalhes e o que foi deliberadamente deixado de fora em `docs/DECISIONS.md`.
- ✅ Pós-Fase 8 — Verificação de presença digital (o produto existe para achar empresas sem site, não é um detalhe secundário): botão "Verificar site" por resultado de busca, usando a Brave Search API (comercialmente permitida, ao contrário de raspar resultados do Google) com uma lista de domínios não-próprios (redes sociais, diretórios de CNPJ, marketplaces) e um casamento de nome por sobreposição de tokens — um indício, nunca uma certeza ("sem site identificado", não "não tem site"). Deliberadamente manual por resultado (nunca automático para toda busca) para não esgotar a cota gratuita da API em poucas buscas. Sem `BRAVE_SEARCH_API_KEY`, mostra um "não configurado" honesto — **não testado ao vivo nesta sessão** (não há chave disponível aqui), só com testes unitários (fetch mockado); avaliação de Bing Search API (descontinuada em ago/2025) e Google Custom Search JSON API (fechada para novos clientes) em `docs/DECISIONS.md`.
- ✅ Fase 10 (fundações, 1ª etapa de uma evolução maior aprovada após auditoria somente leitura) — lista de supressão/LGPD (`suppression_entries`, normalizada e isolada por organização), fila assíncrona real sobre a tabela `jobs` (que só existia no schema desde o PRD original — `claim_next_job` atômico, retry com backoff + dead-letter, worker em `/api/v1/jobs/worker` via Vercel Cron, dá uso de novo ao `CRON_SECRET` órfão desde a remoção do billing na Fase 9), rate limiting distribuído via Postgres (`check_rate_limit`, substitui o contador em memória do middleware, com fallback automático se o banco cair), e auditoria (`audit_logs`) estendida para aprovação/rejeição de organização, credenciais de integração e cobranças Asaas. Nenhum fornecedor novo contratado (fila dedicada, Redis, Sentry e upgrade de backup do Supabase continuam como decisões de negócio pendentes). Um bug real (`check_rate_limit` com coluna de retorno ambígua) só apareceu na verificação ao vivo contra o banco, não no typecheck/lint/testes — corrigido e documentado em `docs/DECISIONS.md`.
- ✅ Módulo 1 — Enriquecimento Inteligente de Empresas: tabela `company_enrichment_fields` guarda cada achado (e-mail, telefone, site, redes sociais) como proposta `pending` — nunca grava direto em `companies` até um humano aceitar. Extração **determinística via regex** sobre o HTML do próprio site (links `mailto:`/`tel:`/redes sociais conhecidas) — deliberadamente sem IA, para não inventar fatos nem gastar custo numa tarefa que não precisa de interpretação; `is_ai_inferred` fica reservado para um incremento futuro. Botão "Enriquecer" na página da empresa (busca síncrona, mostra "sem site identificado" honestamente) e botão "Enriquecer empresas pendentes" na listagem, que enfileira um job `enrich_company` por empresa — primeiro uso de negócio real da fila assíncrona da Fase 10. Detalhes em `docs/DECISIONS.md`.
- ✅ Módulo 3 — Digital Presence Score: pontuação 0-100 por fórmula de pesos transparente (site 30, e-mail 15, telefone 15, até 4 redes sociais a 10 cada) — nunca por IA. `digital_presence_scores` é histórico (nunca sobrescreve: cada recálculo é uma linha nova com os pesos/sinais usados, para auditar a mudança). Recalculado automaticamente ao aceitar uma proposta de enriquecimento (Módulo 1) e manualmente via botão "Recalcular" na página da empresa. Módulo 2 (Website Audit) foi deliberadamente pulado por agora — a ordem oficial do plano prioriza o que depende do enriquecimento recém-emitindo dados antes do que depende de uma integração externa isolada. Detalhes em `docs/DECISIONS.md`.
- ✅ Módulo 4 — Lead Scoring 2.0: decompõe o placar único de 6 critérios do Lead Scorer (Fase 5) em 3 dimensões — Potencial, Aderência e Prioridade — sem nenhuma chamada de IA nova: é só uma reagregação determinística dos mesmos números que o Lead Scorer já devolve, usando os pesos já existentes. `lead_scores` é histórico (mesmo princípio do Módulo 3); `leads.score` (campo único da Fase 5) continua funcionando normalmente como "cache do valor atual". Gravado automaticamente a cada qualificação; ação manual para leads qualificados antes deste módulo existir. Módulo 2 (Website Audit) continua pulado, aguardando a decisão de negócio pendente sobre a API do Google PageSpeed. Detalhes em `docs/DECISIONS.md`.
- ✅ Módulo 5 — Recomendação de Serviços: investigação revelou que o Company Analyzer (Fase 5) já gera `opportunities` (serviço + motivo + prioridade, ancoradas no catálogo real de serviços) e já exibe isso na página da empresa — então este módulo não duplica essa IA. Em vez disso: (1) a Pontuação de Presença Digital (Módulo 3) passa a entrar como mais um fato determinístico na análise da empresa (prompt do Company Analyzer sobe para `v2`); (2) nova página "Recomendações" no menu agrega, numa lista única e filtrável por serviço/prioridade, as oportunidades de todas as empresas — hoje só dava para ver empresa por empresa. Nenhuma tabela nova: a agregação usa uma `VIEW` (`latest_company_service_opportunities`, com `security_invoker` para preservar a RLS de quem consulta) sobre o `ai_analyses` que já existia. Detalhes em `docs/DECISIONS.md`.
- ✅ Módulo 6 — Campanhas de Vendas: `campaigns`/`campaign_companies`/`campaign_messages` (novas tabelas). Selecione um grupo de empresas, gere um e-mail personalizado por IA para cada uma (mesma filosofia anti-disparo-em-massa do Outreach Generator — nunca um template reaproveitado), revise/edite, aprove (humano sempre no controle) e envie — individualmente ou em lote (fila assíncrona da Fase 10). O texto de descadastro/LGPD não tem padrão da plataforma: cada organização escreve o seu em Configurações → Perfil, e o envio é bloqueado até isso ser preenchido. De passagem, corrigi uma lacuna real: o envio manual de e-mail de prospecção (Fase 5) nunca checava a lista de supressão antes de enviar — agora checa, assim como o envio de campanha. Detalhes em `docs/DECISIONS.md`.
- ✅ Módulo 2 — Website Audit: desbloqueado sob a premissa "só integrações gratuitas/open source" — a Google PageSpeed Insights API tem cota gratuita generosa e não exige faturamento habilitado, só uma chave de API por organização (mesmo padrão Vault de Asaas/OpenAI/Gmail). Novo card "Auditoria de site" na página da empresa: scores de desempenho/acessibilidade/boas práticas/SEO, Core Web Vitals (LCP/CLS/TBT) e lista de problemas — tudo extraído por uma função pura e testada, nunca inventado. Histórico append-only (`website_audits`, mesmo princípio do Módulo 3) mesmo quando a auditoria falha. Rate limit de 20 auditorias/hora por organização para proteger a cota gratuita de um loop acidental. Detalhes em `docs/DECISIONS.md`.
- ❌ Módulo 8 — WhatsApp Business: **cortado do sistema**, não implementado. Sob a premissa "só integrações gratuitas/open source", nenhuma das duas rotas reais passa com segurança: a API oficial da Meta tem nível gratuito mas depende de verificação de negócio pela Meta (processo externo, prazo imprevisível, fora de controle); as bibliotecas open source não-oficiais (Baileys, whatsapp-web.js) são gratuitas mas violam os Termos de Serviço do WhatsApp e arriscam banimento permanente do número da organização — risco de negócio que não é inferido silenciosamente. Nenhuma tabela/rota/credencial de WhatsApp foi criada; o convite manual por WhatsApp nos e-mails de prospecção (Fase 5) continua existindo e não é afetado. Decisão completa em `docs/DECISIONS.md`.

## Segurança — regras que todo PR deve respeitar

- `organization_id` nunca é confiado a partir do browser — sempre resolvido/
  revalidado no servidor (`src/modules/organizations/active-organization.ts`).
- RLS é a defesa primária; `src/lib/permissions/permissions.ts` adiciona
  revalidação explícita antes de mutações, para mensagens de erro melhores.
- `SUPABASE_SERVICE_ROLE_KEY` só é usada em `src/lib/supabase/admin.ts`, nunca
  em código que pode ser bundlado para o cliente.
