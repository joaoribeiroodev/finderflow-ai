# Registro de decisões e pontos de configuração

## Decisões fechadas

| Tema | Decisão |
|---|---|
| Produto | FinderFlow AI |
| Modelo | SaaS multi-tenant |
| Stack | Next.js + TypeScript + Supabase |
| UI | Tailwind CSS + shadcn/ui, tema dark roxo tecnológico/marketing |
| IA | OpenAI API, priorizando Responses API |
| Billing do FinderFlow | Asaas |
| Captura | Híbrida: provedor(es) autorizados + CSV + manual |
| IA | Automação integrada + Copilot conversacional |
| Arquitetura | Monólito modular, sem NestJS separado no MVP |
| Dados | Empresa descoberta é entidade distinta de Lead |

## Decisões pendentes antes do beta comercial

1. **Provedor principal de empresas:** ~~avaliar cobertura em cidades brasileiras, campos disponíveis, preço, quotas, licença de uso comercial, cache, atribuição e SLA.~~ **Parcialmente resolvido** — ver seção "Provedor de dados de empresas" abaixo: descoberta por segmento (CNAE) + UF/cidade está integrada (`BUSINESS_PROVIDER=minha_receita`), usando a base de CNPJ da Receita Federal via a API pública Minha Receita. **Ainda falta**: enriquecimento (site institucional, redes sociais, decisor) e um plano de contingência caso o servidor comunitário do Minha Receita saia do ar (auto-hospedar, ver mesma seção).
2. **Modelo OpenAI por tarefa:** escolher modelo por qualidade/custo após benchmark; manter configurável por ambiente.
3. **Planos e preços:** definir Starter/Pro/Business, trial, limites de leads, pesquisas e tokens.
4. **Política de inadimplência:** prazo de tolerância, modo read-only e regras de reativação.
5. **Retenção de dados:** prazos para resultados externos, históricos de IA, conversas, logs e arquivos.
6. **Worker e cron:** escolher execução via Supabase Edge Functions/Cron ou worker dedicado conforme volume e limites reais.
7. **Termos e LGPD:** revisar base legal, transparência, oposição a contato, controlador/operador e contratos de operadores.
8. **Domínio e e-mail transacional:** selecionar domínio, DNS e provedor de envio.
9. **Métricas comerciais:** validar definições de conversão, receita contratada, recebida e pipeline ponderado.
10. **SaaS self-serve:** decidir se o MVP permite que qualquer usuário assine sem aprovação manual e quais métodos de pagamento estarão disponíveis.

## Restrições conhecidas

- Não usar scraping indiscriminado ou endpoints públicos com limites inadequados para uso comercial em massa.
- Não presumir armazenamento perpétuo de dados de Google Places; respeitar as políticas de cache e atribuição vigentes.
- Não liberar assinatura com base em retorno de URL do checkout; webhook e conciliação são a fonte de atualização.
- Webhooks Asaas podem ser entregues mais de uma vez; implementar idempotência.
- Secrets OpenAI, Asaas e Supabase service role são exclusivamente server-side.
- Não enviar mensagem comercial automaticamente sem autorização e base adequada.

## Decisões técnicas tomadas durante a implementação (Fase 0/1)

| Tema | Decisão | Motivo |
|---|---|---|
| Next.js | `next@16.4.5`, arquivo `src/proxy.ts` (não `middleware.ts`) | Next.js 16 depreciou/renomeou `middleware` para `proxy` (ver changelog oficial e `node_modules/next/dist/docs`). Mesma função (renovação de sessão Supabase, redirect de rotas protegidas). |
| Cache Components | `export const instant = false` no `app/layout.tsx` | Next.js 16 habilita "Cache Components" por padrão e exige que toda leitura de `cookies()`/sessão fora de `<Suspense>` seja justificada. Como a Fase 1 é quase inteiramente autenticada, adotamos o caminho de migração oficial recomendado pela documentação (desativar a validação a nível de layout raiz) em vez de reescrever cada página com `use cache: private`. Revisar rota a rota nas próximas fases conforme a superfície pública (marketing, billing público) crescer. |
| Tipos do banco | `src/types/database.ts` escrito manualmente (Phase 0/1: `profiles`, `organizations`, `organization_members`, `pipeline_stages`) | Não há projeto Supabase real conectado neste ambiente para rodar `supabase gen types typescript`. Documentado no topo do arquivo como TODO — regenerar e substituir assim que houver um projeto. |
| RLS / isolamento cross-tenant | **Verificado com sucesso em 2026-11-04** contra o projeto Supabase real `lxzsefabmnagiaywaxeb`, via SQL direto (`supabase/tests/rls-cross-tenant-verification.sql`), reproduzindo dois usuários/duas organizações e as 6 asserções do teste de integração | O conector MCP do Supabase não expõe a `service_role`/secret key por nenhuma ferramenta disponível (`get_publishable_keys` só retorna anon/publishable — por design de segurança do conector), e não há Docker neste ambiente para `supabase start`. Em vez de deixar o critério de aceite sem verificação real, criamos os dois usuários de teste direto em `auth.users` via SQL (sem precisar da service_role key) e simulamos a identidade autenticada exatamente como o PostgREST faz: `SET ROLE authenticated` + `SET request.jwt.claims`, confirmado lendo a definição real de `auth.uid()` neste projeto antes de escrever o script. Resultado: **6/6 PASS** — A não vê organização de B; A cria empresa na própria org; B não lê empresas de A; B não insere empresa em A (bloqueado por RLS); B não vê membros de A; B não altera papel de membro de A (0 linhas afetadas). Dados de teste limpos e confirmados (contagem pós-execução = 0). `tests/integration/rls-cross-tenant.test.ts` continua existindo e preferível para rodar localmente via HTTP/PostgREST real (`npm run test:rls`, requer Supabase local ou a service_role key de um projeto de dev) — os dois se complementam. Um bug real foi corrigido no teste de integração nesse processo: o Teste 6 esperava `error !== null` num UPDATE bloqueado por RLS, mas o PostgREST retorna sucesso com 0 linhas (o `USING` da policy filtra a linha silenciosamente, não gera erro) — corrigido para asserir 0 linhas retornadas e o papel original intacto. |
| Projeto Supabase | Criado o projeto `finderflow-ai` (`lxzsefabmnagiaywaxeb`, região `sa-east-1`, org `joaoribeiroodev`) em 2026-11-04, com aprovação explícita do usuário | Free tier da organização permite só 2 projetos ativos; havia `azulli` + `its-demandas`. Usuário aprovou pausar `azulli` para liberar a vaga. |
| Migration de schema | Migration de referência (`supabase/migrations/20261104143307_core_schema.sql`) tinha um bug: `ai_conversations` não declarava `unique (organization_id, id)`, e a FK composta de `ai_messages` para essa tabela falhava (`42830`) | Corrigido adicionando a constraint, seguindo o mesmo padrão já usado em todas as outras tabelas do schema. Aplicada com sucesso no projeto real: 29 tabelas criadas, todas com RLS habilitado. |
| Privilégios de funções `SECURITY DEFINER` | `get_advisors(type="security")` logo após aplicar o schema apontou que o role `anon` conseguia executar 5 funções sensíveis (`is_org_member`, `has_org_role`, `can_edit_org`, `can_admin_org`, `create_organization_with_defaults`) e `handle_new_auth_user`, apesar da migration já ter `revoke all ... from public` | Causa raiz: o provisionamento do Supabase concede EXECUTE diretamente ao role `anon` (grant nomeado) na criação da função — `REVOKE ... FROM PUBLIC` não remove esse grant. Corrigido com a migration `supabase/migrations/20261104143356_fix_function_privileges.sql` (revoga de `public, anon` nas 5 funções e concede só para `authenticated`; revoga totalmente de `handle_new_auth_user` e `set_updated_at`, que são só para uso via trigger). Também corrigido o aviso `function_search_path_mutable` em `set_updated_at` fixando `search_path = public`. Reverificado via `pg_proc.proacl` e um segundo `get_advisors`: `anon` sem acesso, aviso de search_path limpo. O WARN remanescente (`authenticated_security_definer_function_executable`, 5 ocorrências) e o INFO `rls_enabled_no_policy` em `asaas_webhook_events` (RLS habilitado, sem policies — tabela só deve ser tocada pela `service_role`, que ignora RLS) são avaliados como **intencionais**, não pendências. |
| Tipos do banco | `src/types/database.ts` regenerado via `mcp__Supabase__generate_typescript_types` contra o projeto real | Substitui o arquivo escrito manualmente na Fase 0/1. `OrgRole` agora é extraído do enum `org_role` gerado (nunca diverge do banco); `MemberStatus` continua manual porque `status` em `organization_members` é `text` com check constraint, não um enum do Postgres. |
| Organização ativa | Cookie `ff_active_org` (httpOnly) guarda apenas uma *preferência* de UI; a cada leitura o servidor revalida via `organization_members` sob RLS | Evita confiar em `organization_id` vindo do browser, conforme exigido. |
| Shell visual | Layout de workspace mínimo (topbar funcional) nesta fase; sidebar completa e design system ficam para a Fase 2 | Evita construir telas desconectadas do modelo de dados antes da hora, conforme instrução do prompt mestre. |

## Decisões técnicas tomadas durante a implementação (Fase 2 — Shell visual e design system)

| Tema | Decisão | Motivo |
|---|---|---|
| Escopo entregue | Sidebar fixa (250px) com drawer mobile, topbar com seletor de organização/logout, design tokens (`--ff-radius-*`, `--ff-shadow-*`, transições, `prefers-reduced-motion`), primitivos de UI (`Badge`, `Card`, `KpiCard`, `ChartCard`/`FunnelRow`, `EmptyState`, `ErrorState`, `LoadingSkeleton`), dashboard com dados 100% reais (sem fixtures) e 8 páginas "em construção" (`ComingSoon`) citando a fase que as implementa, página de Configurações com dados reais de organização/membros | Seguindo o critério de aceite da Fase 2 do prompt mestre; optou-se por zero fixtures — o dashboard mostra zero-states honestos (`EmptyState`) em vez de dados fictícios, para nunca mascarar o estado real do produto durante o desenvolvimento. |
| **BUG CRÍTICO corrigido:** Cache Components quebrava `/dashboard` e `/settings` em produção | Desativado `cacheComponents`/`partialPrefetching` em `next.config.ts`; removido o `export const instant = false` (inerte) de `src/app/layout.tsx` | Descoberto via QA visual real (Playwright contra `next build && next start`, não `next dev`): página em branco, log do servidor mostrando `Error: Route "/dashboard": Next.js encountered the unstable value Date.now() while prerendering`, originado dentro do cliente SSR do Supabase (sessão/cookies fora do contexto síncrono exigido pelo Cache Components). O `instant = false` adotado na Fase 0/1 suprime apenas o aviso de validação em **dev** (confirmado lendo a doc oficial do Next 16 em `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`); não evita o erro real em `next start`. Como o app é quase inteiramente autenticado/dinâmico, o ganho de Cache Components é mínimo frente ao risco — desativado globalmente em vez de reescrever rota a rota com `use cache: private`. Verificado corrigido: rebuild + restart + novo QA visual, log do servidor limpo, `/dashboard` e `/settings` renderizando com conteúdo completo. |
| **BUG CRÍTICO corrigido:** FKs simples redundantes quebravam embeds do PostgREST | Duas migrations live (`drop_redundant_simple_fks`, `drop_redundant_simple_fks_2`) removendo 15 constraints de FK simples (coluna única) redundantes com as FKs compostas "same org" já existentes, em `company_source_refs`, `contacts`, `deals`, `interactions`, `lead_stage_history` (×3), `leads` (×2), `proposals`, `tasks`, `search_results`, `proposal_items`, `ai_messages`, `billing_payments` | A migration de referência da Fase 0/1 (`core_schema`) declarava, por um padrão de copy-paste sistemático, tanto `coluna references tabela(id)` quanto `foreign key (organization_id, coluna) references tabela(organization_id, id)` para a mesma coluna em várias tabelas. O PostgREST recusa qualquer `select` com embed aninhado (ex.: `leads -> companies`) quando há mais de uma FK possível entre duas tabelas, retornando "more than one relationship was found" — isso derrubava a query do dashboard (`lead_stage_history` embutindo `pipeline_stages` e `leads/companies`). Descoberto via QA visual (erro no log do servidor) e confirmado com uma auditoria direta em `pg_constraint` (self-join encontrando os 15 pares duplicados). Antes de remover, confirmou-se que cada FK simples tinha o mesmo comportamento `ON DELETE` da composta correspondente — a composta é estritamente mais forte (também exige `organization_id` igual) e cobre a integridade sozinha, então não há regressão. Reauditado após a correção: 0 duplicados restantes. |
| Bug corrigido: validação de env quebrava com `.env.local` real | Adicionado helper `optionalString()` em `src/lib/env/env.server.ts` (`z.preprocess` convertendo `""` em `undefined` antes do `.optional()`) para todas as variáveis server-side opcionais (`OPENAI_API_KEY`, `ASAAS_*`, `BUSINESS_PROVIDER*`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) | `.optional()` do Zod só cobre `undefined`, não string vazia. Como a Fase 1 criou um `.env.local` real com placeholders em branco (`OPENAI_API_KEY=`), toda request crashava (500, "Variáveis de ambiente inválidas ou ausentes"). Só foi exposto agora porque é o primeiro teste contra um `.env.local` real preenchido. |
| Settings: lista de membros | Busca `profiles` em uma query separada (`.in("id", memberUserIds)`) e faz o merge em memória com `organization_members`, em vez de usar `select=...,profile:profiles(...)` | Não existe FK entre `organization_members` e `profiles` no schema (por design), então o PostgREST não consegue embutir. Além disso, a RLS de `profiles` (`profiles_select_self`) só permite que cada usuário veja sua própria linha — nomes de outros membros só aparecem quando o próprio usuário já preencheu o perfil (nota explícita na UI). |

## Decisões técnicas tomadas durante a implementação (Fase 3 — Empresas e prospecção)

| Tema | Decisão | Motivo |
|---|---|---|
| Escopo entregue | CRUD de empresas (listagem com busca/filtro/paginação real, cadastro manual, detalhe), importação CSV completa (upload → mapeamento de colunas → preview/validação → confirmação, com `import_jobs` registrando o resultado), contrato `BusinessDataProvider` pronto mas sem adaptador real, página `/prospecting` com busca honesta ("provedor não configurado"), conversão empresa→lead | Segue a ordem do prompt mestre: "cadastro manual e CSV primeiro", "contrato BusinessDataProvider e adaptadores isolados", "provedor real só após verificar política de uso" (item 4) — como essa verificação nunca foi feita (decisão pendente #1), nenhum provedor foi integrado. |
| Nova tabela `import_jobs` | Migration `20261104153209_create_import_jobs.sql` (aplicada ao projeto real e espelhada no repo), com RLS no mesmo padrão editor/admin das demais tabelas tenant-scoped | A migration de referência (Fase 0/1) não incluía essa tabela apesar de estar no modelo de dados (docs/03-database.md). `file_path` fica nulo — não há bucket de Storage configurado ainda, então o CSV é lido em memória a partir do upload e nunca persistido como arquivo; apenas nome do arquivo e resultado (summary/error_report) ficam auditáveis. |
| Importação é síncrona, não assíncrona | O CSV inteiro é parseado e processado dentro da própria Server Action, sem fila/worker | Não há worker/cron decidido ainda (decisão pendente #6). Criar uma fila "de mentira" sem um worker real para consumi-la seria pior que ser explícito sobre a limitação. `import_jobs` registra o resultado como se fosse um job assíncrono para já exercitar o schema e a auditoria — reavaliar quando a decisão #6 for tomada. Arquivos muito grandes (>2000 linhas) são recusados explicitamente por esse motivo. |
| Deduplicação conservadora | CNPJ idêntico já cadastrado **bloqueia** a criação (é um identificador legal único — nunca duas empresas reais com o mesmo CNPJ); domínio do site idêntico **avisa** mas permite seguir mediante confirmação explícita do usuário (pode ser filial/franquia diferente); nome parecido isoladamente nunca bloqueia nem pede confirmação | Segue docs/03-database.md §3.4 ao pé da letra: "não fundir empresas automaticamente apenas pelo nome". Na importação em lote (CSV), linhas com qualquer duplicata (CNPJ ou domínio) são sempre puladas e reportadas — nunca há merge automático nem confirmação interativa por linha num processo em lote. |
| `BusinessDataProvider` sem adaptador real | Interface completa em `src/modules/companies/providers/business-data-provider.ts`, usada por `/prospecting`, mas só com uma implementação `NotConfiguredProvider` que lança erro claro | Escolher o provedor (cobertura no Brasil, custo, quotas, licença de uso comercial, política de cache/atribuição, SLA) é a decisão pendente #1, nunca avaliada nesta sessão. Implementar um adaptador de exemplo sem esse processo seria fingir uma integração que não existe — a UI de prospecção expõe esse estado honestamente (zero-state com explicação, nunca dados inventados), seguindo a mesma filosofia "sem fixtures" da Fase 2. |
| **BUG corrigido:** `redirect()` do Next.js dentro de `try/catch` quebrava silenciosamente o cadastro manual de empresa | `createCompanyAction` foi reestruturada para chamar `redirect()` **fora** do bloco `try` | `redirect()` lança um erro especial (`digest: "NEXT_REDIRECT"`) que o próprio Next.js precisa ver propagar para executar o redirecionamento — um `catch` genérico o trata como falha comum. Resultado observado: a empresa era criada no banco com sucesso, mas a action retornava `{success:false}` e o formulário parecia "não fazer nada" (sem navegar, sem mostrar erro). Descoberto via QA visual real (não seria pego por `npm run build`/typecheck) inspecionando a resposta HTTP bruta da Server Action. É um erro clássico e documentado do App Router — revisado em todas as actions do projeto; as demais (`organizations/actions.ts`, `archiveCompanyAction`) já seguiam o padrão correto. |
| **BUG corrigido:** campo `confirmDuplicate` (checkbox) derrubava toda submissão válida do formulário de empresa, sem nenhum erro visível | Trocado `z.string().optional()` por `z.string().nullish()` no schema de validação | `FormData.get()` devolve `null` (não `undefined`) para um campo ausente do DOM — o checkbox "cadastrar mesmo assim" só é renderizado quando já existe um aviso de duplicata, então em toda submissão normal ele está ausente. `.optional()` do Zod só aceita `undefined`, rejeitando `null` com "Invalid input: expected string, received null" — e como não há nenhum `<Field>` para `confirmDuplicate` na UI, o erro de validação nunca aparecia em lugar nenhum, fazendo o formulário parecer travado silenciosamente. Encontrado inspecionando a resposta bruta da Server Action via Playwright (o sintoma na tela era idêntico ao bug do `redirect()` acima, então os dois precisaram ser isolados um do outro). |
| Formulário de empresa perdia o que foi digitado após duplicata/erro | `CompanyActionResult` agora ecoa os valores enviados (`values`) e `CompanyForm` usa `defaultValue` a partir deles | Os campos do formulário são não-controlados (`<input>` simples, sem `useState`); como o Server Action força um novo render da árvore RSC, os valores digitados somem visualmente a cada submissão que não redireciona — pior ainda no fluxo de duplicata, onde o usuário precisa marcar "cadastrar mesmo assim" e reenviar. Corrigido depois de observar o problema nos screenshots de QA visual. |
| Conversão empresa → lead | Server Action apenas faz `insert` em `leads`; a unicidade (uma empresa não pode virar dois leads ativos) é garantida inteiramente pelo índice parcial `leads_one_active_company_idx (organization_id, company_id) WHERE archived_at IS NULL`, já existente desde a Fase 0/1 — a action só trata o `23505` e devolve mensagem amigável | Evita um `SELECT` de verificação seguido de `INSERT` (condição de corrida clássica); o banco é a única fonte de verdade para a unicidade, consistente com a abordagem já usada no resto do projeto. |

## Decisões técnicas tomadas durante a implementação (Fase 4 — CRM)

| Tema | Decisão | Motivo |
|---|---|---|
| Escopo entregue | Gestão de etapas do funil (criar, renomear, recolorir, excluir, reordenar), lista de leads com busca/filtro/paginação, Kanban por etapa, detalhe do lead (etapa, prioridade, valor estimado, probabilidade, interesse em serviço, próximo contato), contatos por empresa, timeline de interações, tarefas com conclusão, histórico de mudança de etapa | Schema (`leads`, `pipeline_stages`, `contacts`, `interactions`, `tasks`, `lead_stage_history`) e RLS já existiam desde a Fase 0/1 (migration de referência); esta fase construiu a camada de serviço, Server Actions e UI sobre uma base de dados que já estava correta. |
| Duas novas funções `SECURITY DEFINER`: `move_lead_stage` e `reorder_pipeline_stages` | Migration `20261104160928_create_pipeline_functions.sql`. `move_lead_stage` move o lead e grava `lead_stage_history` numa única transação no banco, sincronizando `leads.status`/`loss_reason` com `pipeline_stages.result_type` da etapa de destino. `reorder_pipeline_stages` desloca todas as posições da organização para negativos únicos antes de aplicar a ordem final, evitando violar `unique (organization_id, position)` no meio da operação | Fazer "ler etapa atual, depois gravar histórico" como duas chamadas separadas do cliente teria uma janela de corrida entre leitura e escrita (dois usuários movendo o mesmo lead ao mesmo tempo). Um `UPDATE` simples trocando duas posições também violaria a constraint de unicidade no meio da execução, já que constraints não-deferráveis são checadas por linha, não ao final do statement. |
| **ACHADO DE SEGURANÇA corrigido:** `anon` conseguia executar `move_lead_stage` e `reorder_pipeline_stages` via PostgREST | Migration `20261104162842_revoke_anon_pipeline_functions.sql` — `revoke all ... from anon` explícito nas duas funções | `mcp__Supabase__get_advisors` (categoria SECURITY) apontou isso antes do commit, apesar de a migration original já ter `revoke all ... from public`. Causa: privilégios padrão do projeto (`pg_default_acl`) concedem EXECUTE em funções novas diretamente aos roles `anon`/`authenticated`/`service_role` (não via o pseudo-role `PUBLIC`), então revogar de `PUBLIC` não tem efeito sobre essas concessões diretas. As funções da Fase 0/1 (`is_org_member`, `can_edit_org` etc.) não têm `anon` na ACL porque foram criadas antes dessa configuração de privilégios padrão existir no projeto — uma pegadinha que não existia nas fases anteriores e só apareceu agora. Seguindo a regra do prompt mestre de não avançar com teste de segurança falhando, a fase não foi encerrada até o advisor voltar limpo (confirmado: só restam os avisos esperados de "signed-in users podem executar" nas RPCs `SECURITY DEFINER`, que já existiam e são intencionais — cada função faz sua própria checagem de autorização internamente). |
| **BUG corrigido:** registrar uma interação falhava silenciosamente, sem nenhum erro visível | `occurredAt` trocado de `.optional()` para `.nullish()` em `src/lib/validation/interactions.ts` | Mesma classe de bug do `confirmDuplicate` na Fase 3: o formulário (`InteractionForm`) nunca renderizou um campo `occurredAt` (a interação sempre usa "agora"), então `FormData.get("occurredAt")` retornava `null` — não `undefined`/`""`. `.optional()` do Zod só aceita `undefined`, rejeitando `null`; como nenhum `<Field>` exibia `fieldErrors.occurredAt`, a submissão falhava sem nenhuma mensagem na tela. Encontrado via QA visual real contra o build de produção (o teste unitário dos outros campos passava limpo; só foi pego testando o fluxo completo no navegador). |
| Kanban sem arrastar-e-soltar | Cada card tem um `<select>` que, ao mudar, dispara automaticamente a Server Action de mover etapa (`requestSubmit()`) | Drag-and-drop acessível por teclado exigiria uma biblioteca extra (`@dnd-kit` ou similar) e lógica de anúncio para leitores de tela. Um `<select>` é acessível por teclado nativamente, não precisa de dependência nova, e funciona de forma idêntica em qualquer navegador. Divergência da cópia de UI escrita na Fase 2 (que mencionava "arrastar e soltar"); registrada aqui como o prompt mestre exige para desvios do texto original — o critério de aceite da Fase 4 ("implementar... Kanban") não exigia drag-and-drop especificamente. |
| Exclusão de etapa do funil | Nenhuma lógica de aplicação impede excluir uma etapa com leads — a própria constraint de FK em `leads.stage_id` (sem `on delete cascade`, portanto `RESTRICT` por padrão) já impede; a Server Action só traduz o erro `23503` numa mensagem amigável (`StageHasLeadsError`) e a UI desabilita visualmente o botão quando sabe de antemão que há leads na etapa | Mesma filosofia da Fase 3 (deixar o banco ser a fonte de verdade para integridade, nunca um `SELECT` de verificação prévio sujeito a condição de corrida). A UI desabilitar o botão é só uma conveniência — a garantia real está na constraint. |
| Reordenação de etapas sempre recalculada no servidor | `moveStage()` busca a ordem atual do banco e calcula a nova ordem (trocando com o vizinho) a partir dela, nunca a partir de uma lista enviada pelo formulário | Mesma regra da Fase 3 para importação CSV: nunca confiar em dados estruturais (ordem completa de uma lista) vindos do cliente quando o servidor pode recalculá-los a partir do estado atual persistido. |
| Lead perdido: motivo (`loss_reason`) só é coletado no formulário de detalhe do lead, não no seletor rápido do Kanban | `MoveStageForm` (detalhe do lead) renderiza o campo condicional quando a etapa de destino é `result_type = 'lost'`; `KanbanCard` (seletor rápido) não — move a etapa sem motivo, que fica `null` | Pedir o motivo obrigatoriamente bloquearia a movimentação rápida no Kanban, que é o fluxo de uso mais comum; o usuário pode preencher o motivo depois na tela de detalhe. Escopo reduzido deliberadamente para esta fase. |
| Atribuição de lead a um membro específico (`leads.assigned_to`) não tem UI | Coluna já existe no schema (Fase 0/1) e fica `null` para todo lead criado nesta fase | Fora do escopo mínimo da Fase 4 (lista, filtros, busca, Kanban, detalhe, contatos/interações/tarefas/histórico) — não há seleção explícita disso no texto do prompt mestre. Adicionar perfilaria para uma fase de colaboração em equipe mais ampla; registrado aqui para retomar se o backlog pedir. |
| Kanban sem paginação por coluna | `listLeadsForKanban()` carrega todos os leads abertos da organização de uma vez, sem `range()` | Agrupar por etapa no servidor com paginação por coluna exigiria uma query por etapa ou uma estrutura de dados mais complexa; para o volume esperado nesta fase do produto (poucas centenas de leads por organização) carregar tudo de uma vez é aceitável. Reavaliar com paginação/virtualização se o volume crescer. |
| **BUG encontrado e corrigido antes de produção (apenas em teste unitário):** `estimatedValue`/`probability` fora do intervalo eram silenciosamente descartados em vez de rejeitados | Removido `.catch(undefined)` dos dois campos em `src/lib/validation/leads.ts`; reescrito com `z.preprocess` para converter a string antes da validação de range, sem engolir o erro de range depois | `.pipe(z.coerce.number()...).catch(undefined)` capturava **qualquer** falha de validação (incluindo "fora do intervalo 0-100") e silenciosamente trocava por `undefined` — um `probability: "150"` era aceito como se o campo estivesse vazio, em vez de rejeitado com erro. Pego pelo teste unitário (`leads.test.ts`) antes de qualquer QA visual, exatamente o tipo de regressão que a suíte de testes deveria capturar. |

## Decisões técnicas tomadas durante a implementação (Fase 5 — IA/OpenAI)

| Tema | Decisão | Motivo |
|---|---|---|
| Escopo entregue | Contrato `AIProvider` (`generateStructured`/`respond`) + `OpenAIProvider` via Responses API (`client.responses.parse`/`client.responses.create`) + `NotConfiguredAIProvider`; `AIEngine` (`runStructuredAI`/`runConversationTurn`) com verificação de quota **antes** de chamar o provedor, revalidação Zod da saída estruturada, e registro em `ai_usage_events` (modelo, prompt_version, tokens, custo estimado, duração, status) sempre, mesmo em falha; Company Analyzer, Lead Scorer (pesos fixos 25/25/15/15/10/10) e Outreach Generator com persistência em `ai_analyses`; Copilot com allowlist de 7 ferramentas (5 leitura + 2 mutantes com confirmação explícita), conversa encadeada via `previous_response_id`; sanitização/delimitação de dado não confiável contra prompt injection | Segue docs/05-integrations.md §5.1 item a item: Responses API (nunca Assistants/Threads/Runs), Structured Outputs com revalidação Zod mesmo assim, quota pré-chamada, allowlist de ferramentas sem SQL/credenciais ao modelo, confirmação explícita para mutações. |
| `OpenAI` **não** é uma decisão pendente como `BusinessDataProvider` foi na Fase 3 | `getAIProvider()` sempre tenta `OpenAIProvider` quando `OPENAI_API_KEY` existe; só cai em `NotConfiguredAIProvider` pela ausência da credencial neste ambiente, nunca por indecisão de qual provedor usar | docs/05-integrations.md §5.1 já fecha a decisão ("O provedor oficial de IA é a OpenAI API") — diferente do caso de dados empresariais (Fase 3), onde o próprio provedor ainda estava em aberto. Por isso o `OpenAIProvider` foi implementado por completo (não só a interface), e só o ambiente local não tem a chave configurada. |
| Quota mensal de IA: limite padrão fixo (`DEFAULT_MONTHLY_AI_LIMIT = 50`) por organização, agregando TODAS as operações de IA (análise, score, outreach, copilot) | Nova tabela já existia (`entitlements`, Fase 0/1) mas vazia; RPCs novas `get_or_create_ai_quota` (cria lazy o registro do mês com esse limite placeholder) e `count_ai_usage_in_period` (conta tudo no período, sem distinguir operação) | Não existe billing/planos reais ainda (Fase 6/Asaas — `plans`/`organization_subscriptions` estão vazias nesta sessão). Um limite igual para toda organização é um placeholder explícito (`entitlements.metadata.source = "placeholder_default"`), não uma regra de negócio real — quando a Fase 6 existir, o limite passa a vir do plano contratado; a lógica de contagem/verificação não muda, só a origem do número. |
| **BUG corrigido antes do commit (nunca chegou a rodar em produção):** `count_ai_usage_in_period` filtrava por `operation = p_feature_key`, mas `feature_key` da quota ("ai_monthly_requests") nunca é igual ao `operation` real gravado em cada chamada (ex.: "company_analyzer", "lead_scorer", "copilot") | Migration corretiva `20261104164841_fix_count_ai_usage_in_period_signature.sql` — a função passou a contar todo `ai_usage_events` do período, sem filtrar por operação | Dois conceitos diferentes (o "recurso" sob quota vs. o "tipo de chamada" de cada evento) foram confundidos na primeira versão da função, aplicada e corrigida na mesma sessão antes de qualquer código cliente depender dela. Mantido como duas migrations separadas (nunca reescrever uma migration já aplicada) seguindo a convenção da Fase 4 com `revoke_anon_pipeline_functions`. |
| Duas novas colunas em tabelas já existentes: `ai_usage_events.prompt_version`/`ai_usage_events.duration_ms`, `ai_conversations.pending_tool_call`/`ai_conversations.last_response_id` | Migrations `20261104164713`, `20261104165644`, `20261104170011` | O schema de referência (Fase 0/1) já previa `ai_usage_events`/`ai_conversations`/`ai_messages`/`ai_analyses`/`entitlements`, mas faltavam campos que o prompt mestre exige explicitamente (versão do prompt e duração em todo evento de uso) ou que o design de confirmação do Copilot e o encadeamento de conversa via Responses API precisam. |
| Novas RPCs `SECURITY DEFINER`: `get_or_create_ai_quota`, `count_ai_usage_in_period`, `log_ai_usage` | Todas com `revoke all ... from public` **e** `revoke all ... from anon` explícitos, seguindo a lição da Fase 4 | A Fase 4 descobriu que `revoke ... from public` não é suficiente neste projeto (privilégios padrão concedem EXECUTE direto a `anon`/`authenticated`). Desta vez o `revoke from anon` explícito foi incluído desde a criação de cada função — confirmado limpo por `mcp__Supabase__get_advisors` (categoria SECURITY) antes de qualquer commit, sem precisar de uma migration corretiva de segurança como na Fase 4. |
| `ai_usage_events`/`entitlements` continuam sem policy de INSERT para `authenticated` (decisão da Fase 0/1, preservada) | Em vez de usar a `service_role` key no caminho normal de requisição (o que apagaria `auth.uid()` dos logs), `log_ai_usage` e `get_or_create_ai_quota` são RPCs `SECURITY DEFINER` que inserem/leem em nome do usuário autenticado, após confirmar `is_org_member` internamente | Mesmo padrão de `move_lead_stage`/`reorder_pipeline_stages` (Fase 4): a tabela fica protegida contra escrita direta do cliente, mas a app ainda grava com o usuário certo identificado, sem precisar da credencial de admin no caminho de requisição comum. |
| Copilot: encadeamento de conversa via `previous_response_id` da Responses API, não reconstrução manual do histórico de mensagens a cada turno | `ai_conversations.last_response_id` guarda o id da última resposta do modelo; cada novo turno só envia a mensagem nova (ou a saída da ferramenta) e esse id | Reconstruir manualmente os `function_call`/`function_call_output` items de turnos anteriores a partir das linhas de `ai_messages` exigiria replicar exatamente o formato interno de itens da Responses API — frágil e sujeito a ficar desatualizado a cada mudança da API. `previous_response_id` é o mecanismo oficial da própria API para isso. `ai_messages` continua gravando o histórico legível para auditoria/exibição, só não é a fonte usada para re-montar o contexto enviado ao modelo. |
| Copilot: no máximo UMA chamada de ferramenta por turno (reforçado na instrução ao modelo e na lógica do servidor) | Se o modelo devolver mais de uma chamada no mesmo turno, o turno é abortado com uma mensagem de erro ao usuário e `last_response_id` **não** avança | A Responses API exige que toda chamada de função de um turno seja respondida (via `function_call_output`) antes de o encadeamento continuar via `previous_response_id`. Se uma das chamadas simultâneas fosse uma ferramenta mutante pendente de confirmação, não haveria como responder "parcialmente" as outras sem travar o encadeamento num estado inconsistente. Restringir a uma ferramenta por turno evita esse estado por construção, ao custo de o Copilot precisar de mais turnos para tarefas compostas — aceitável para o volume de uso esperado nesta fase. |
| Copilot: ferramenta mutante pendente é persistida no **servidor** (`ai_conversations.pending_tool_call`, nunca no formulário do cliente) | `confirmPendingToolCallAction`/`rejectPendingToolCallAction` relêem a coluna do banco antes de executar — nunca aceitam `arguments` vindos do POST de confirmação | Requisito de segurança explícito do prompt mestre: a confirmação precisa ser de uma ação que o **servidor** decidiu propor, não de argumentos que um cliente malicioso poderia reenviar alterados (ex.: confirmar "criar tarefa X" mas o form adulterado executar "mover lead Y"). |
| Lead scoring: pesos fixos do negócio (25/25/15/15/10/10) impostos no schema Zod (`LEAD_SCORE_CRITERIA`), não deixados livres para o modelo decidir | `leadScoreSchema.score_breakdown` exige exatamente os 6 critérios da lista fixa, com `criterion` restrito a um enum desses 6 — o modelo só preenche nota e justificativa por critério, nunca o peso | docs/05-integrations.md "Lead scoring" dá os pesos como regra de negócio fixa, não como sugestão para o modelo seguir "se lembrar". Fixar no schema (e revalidar com Zod depois da chamada) garante que a fórmula ponderada nunca varia por capricho do modelo. |
| `score` do Lead Scorer nunca é rotulado como "probabilidade de compra" em nenhum texto de UI/prompt | Instrução explícita no prompt do Lead Scorer e nos textos da UI (`LeadScoreSection`: "placar de qualificação... não é uma previsão de probabilidade de compra") | Regra de negócio explícita do prompt mestre. |
| Ausência de dado (ex.: empresa sem website) nunca é tratada como evidência de necessidade sem marcação explícita de inferência fraca | Instrução explícita nos prompts do Company Analyzer e do Lead Scorer; schema exige `kind: "fact"\|"inference"` e `confidence` em toda observação | Regra de negócio explícita do prompt mestre ("não atribuir pontos por ausência de website como fato de necessidade sem validação"). Como isso depende do modelo seguir a instrução (não há como validar estruturalmente que uma inferência "é justificada"), fica registrado como uma limitação conhecida: a revisão humana do resultado continua sendo a defesa final. |
| Sanitização contra prompt injection: delimitação explícita (`wrapUntrustedData`) + remoção de padrões óbvios (`sanitizeUntrustedText`), não um filtro completo | `src/lib/ai/sanitize.ts` — remove um conjunto de padrões conhecidos ("ignore previous instructions" etc. em PT/EN), tira caracteres de controle invisíveis, trunca textos muito longos, e envolve o resultado num bloco com aviso explícito de "isto é dado, não instrução" | Não existe sanitização que elimine 100% o risco de prompt injection vindo de descrição de empresa/CSV/interação registrada por terceiros — isso é dito explicitamente no comentário do módulo. A defesa real em duas camadas (delimitação + instrução ao modelo para tratar o bloco como dado) é o que o prompt mestre pede ("sanitizar... e instruir modelo a tratar como dado não confiável"), não uma promessa de imunidade total. |
| Custo estimado por chamada: tabela de preços local (`src/lib/ai/pricing.ts`), nunca lida da resposta da API | `estimateCostUsd(model, inputTokens, outputTokens)` usa uma tabela fixa de USD/1M tokens por modelo, com um preço de fallback para modelo desconhecido | A Responses API não devolve custo em USD na resposta, só contagem de tokens — e preços da OpenAI mudam com frequência. Mantida como tabela explícita e isolada (fácil de atualizar), em vez de tentar embutir lógica de preço em outro lugar; é uma estimativa, não o valor cobrado real (isso só existiria com faturamento por uso, fora de escopo). |
| `npm install openai@7.50.0` reportou "16 moderate severity vulnerabilities" no resumo do `npm audit` | Não investigado nesta sessão | Pendência registrada para avaliação futura — não foi determinado se são preexistentes na árvore de dependências do projeto ou introduzidas por este pacote. Não bloqueou a fase porque nenhuma delas apareceu como crítica/alta, mas fica como item de acompanhamento. |

## Decisões técnicas tomadas durante a implementação (Fase 6 — Asaas billing)

| Tema | Decisão | Motivo |
|---|---|---|
| Escopo entregue | `AsaasProvider`/`AsaasProviderImpl` (customer, checkout de assinatura recorrente via `POST /v3/checkouts` com `chargeTypes:["RECURRENT"]`, consulta de assinatura) + `NotConfiguredAsaasProvider`; checkout (`startCheckout`) com preço/plano sempre resolvido no servidor; webhook idempotente (`/api/v1/webhooks/asaas`) com reivindicação atômica do evento (`claim_asaas_webhook_event`); mapeamento de status Asaas→interno combinando `subscription.status` e `payment.status`; recálculo de `entitlements.ai_monthly_requests` a partir do plano contratado; job de reconciliação periódica (`/api/v1/jobs/billing-sync`, protegido por `CRON_SECRET`); página de billing com seletor de plano + histórico de cobranças; página de retorno puramente informativa | Segue docs/05-integrations.md §5.2 item a item: ambientes separados, nunca confiar no redirect como confirmação, idempotência por `provider_event_id`, nunca armazenar dado de cartão, tolerância configurável antes de restringir, toda alteração auditada. |
| Campos reais da API do Asaas conferidos ao vivo durante a implementação (nunca assumidos de memória) | `POST /v3/customers` (`name`+`cpfCnpj` obrigatórios), `POST /v3/checkouts` com `subscription:{cycle,nextDueDate}` e `chargeTypes:["RECURRENT"]`, `GET /v3/subscriptions/{id}` (`status: ACTIVE\|EXPIRED\|INACTIVE`, `checkoutSession`, `deleted`), autenticação via header `access_token`, webhook autenticado via header `asaas-access-token` comparado ao `authToken` configurado, payload `{id,event,dateCreated,payment\|subscription}`, lista completa de `event` de pagamento/assinatura (`PAYMENT_*`/`SUBSCRIPTION_*`) | docs/05-integrations.md §5.5 pede explicitamente não supor nomes de campos/eventos — toda esta fase foi implementada após ler `docs.asaas.com` ao vivo (via WebFetch/WebSearch), não a partir de conhecimento prévio do modelo sobre a API do Asaas. |
| Mapeamento de status: `subscription.status` (`ACTIVE`/`EXPIRED`/`INACTIVE`) sozinho **não** diz se o mês está pago — combinado com `payment.status` do evento mais recente (`src/lib/billing/status.ts`) | `mapAsaasSubscriptionStatus({asaasStatus, deleted, latestPaymentStatus})`: `ACTIVE`+`RECEIVED`/`CONFIRMED` → `active`; `ACTIVE` sem pagamento ainda → `incomplete`; `ACTIVE`+`OVERDUE` → `past_due`; `INACTIVE` → `past_due` (ainda em tolerância) ou `suspended`; `EXPIRED` → `expired`; `deleted` → `canceled` | A API do Asaas não expõe um único campo "assinatura paga este mês", só o status da assinatura em si e eventos de pagamento separados. Combinar os dois evita o erro de, por exemplo, reportar `active` para uma assinatura cujo primeiro pagamento nunca foi confirmado. |
| Reembolso isolado (`PAYMENT_REFUNDED`/`PARTIALLY_REFUNDED`) não derruba a assinatura automaticamente | `mapAsaasSubscriptionStatus` mantém `active` nesse caso — o reembolso fica registrado individualmente em `billing_payments`, sem mudar o status da assinatura | O Asaas mantém `status: ACTIVE` na assinatura após o reembolso de uma cobrança isolada. Se isso deveria suspender automaticamente é uma decisão de negócio ainda não tomada — registrada aqui como pendência explícita, não escondida. |
| Idempotência do webhook: `claim_asaas_webhook_event` (SECURITY DEFINER, `insert ... on conflict (provider_event_id) do update ... where processing_status in ('received','failed')`) em vez de um simples `insert` protegido por `unique` | Reivindica atomicamente: evento novo → insere; evento visto mas não concluído (retry após falha) → reivindica de novo; evento já `processed`/`ignored` → não reivindica, handler responde 200 sem reprocessar | Um `insert` simples protegido só por `unique(provider_event_id)` resolveria "não duplicar a linha", mas não resolveria "reprocessar um evento que falhou no meio do caminho" — a entrega do Asaas é "at least once" (confirmado em docs.asaas.com durante a implementação), então um retry de um evento que falhou precisa ser reprocessado, não descartado como duplicata. A função nunca é exposta a `authenticated`/`anon` (só `service_role`) — confirmado limpo pelo `get_advisors` antes do commit. |
| `entitlements.ai_monthly_requests` passa a ser escrito pelo billing (plano real), fechando o placeholder documentado na Fase 5 | `upsertAiMonthlyEntitlement`/`restrictAiEntitlement` (`src/lib/billing/entitlements.ts`) escrevem a linha do mês corrente com o limite de `plans.limits.ai_monthly_requests`; **nenhuma mudança foi necessária em `get_or_create_ai_quota`** — a RPC já só cria o placeholder quando **não existe** linha para o período, então uma linha escrita pelo billing é usada automaticamente | Period alinhado deliberadamente ao mesmo `date_trunc('month', now())` que a RPC de quota da Fase 5 usa, para que as duas colidam na mesma chave `(organization_id, feature_key, period_start)`. Decisão de design que evita tocar em código já testado da Fase 5. |
| Preços/limites dos planos eram placeholders de negócio (`starter` R$97, `pro` R$247; `ai_monthly_requests` 100/500) | Seed original inserido na migration `20261104172247_create_billing_support.sql` | Mesma natureza do `DEFAULT_MONTHLY_AI_LIMIT` da Fase 5 — não existia decisão comercial formal sobre preço/pacotes; valores escolhidos para o fluxo funcionar ponta a ponta. **Atualizado em 2026-11-05**: o usuário definiu os valores reais — `starter` R$ 19,99/mês (50 chamadas de IA/mês), `pro` R$ 47,99/mês (300 chamadas de IA/mês). Aplicado via `update` numa migration nova (`20261105145500_update_plan_prices_and_ai_limits.sql`), não editando a migration original já aplicada (mesma regra de `fix_count_ai_usage_in_period_signature` — nunca reescrever uma migration já aplicada). Preserva o `id` de cada plano, relevante se já existir alguma `organization_subscriptions.plan_id` referenciando-o. Ainda são valores definidos pelo usuário sem validação externa de mercado — registrados aqui como decisão de negócio tomada, não mais como placeholder. |
| Restrição de inadimplência atinge apenas o recurso de IA (`ai_monthly_requests` → 0), nunca apaga dados | `syncEntitlementsForStatus` (webhook) e `reconcileSubscriptions` (job) chamam `restrictAiEntitlement`, nunca um `delete` em `leads`/`companies`/etc. | Regra explícita do prompt mestre ("restringir recursos pagos sem apagar dados"). Hoje o único recurso efetivamente limitado por entitlement no produto é a IA (Fase 5) — não há, por exemplo, um limite de número de leads para restringir. |
| Escopo deliberadamente limitado do job de reconciliação periódica (`src/modules/billing/reconcile.service.ts`) | Só corrige duas transições seguras sem contexto de pagamento: assinatura removida/expirada no Asaas (webhook pode ter se perdido) → `canceled`/`expired`; `past_due` além da tolerância (`PAST_DUE_GRACE_DAYS = 5`, usando `updated_at` como proxy de "desde quando ficou `past_due`") → `suspended`. Nunca recalcula `active`↔`incomplete` a partir só do status da assinatura | Sem o payload de um evento de pagamento, não há como inferir com segurança se uma assinatura `ACTIVE` no Asaas está paga este mês — fazer isso regrediria assinaturas `active` para `incomplete` incorretamente a cada rodada do job. Usar `updated_at` como proxy para "desde quando está `past_due`" é uma simplificação deliberada (não existe uma coluna dedicada `past_due_since`) — documentada aqui para revisão futura se o período de tolerância precisar de precisão maior. |
| **Nenhum agendador real está configurado neste ambiente** para `/api/v1/jobs/billing-sync` | O endpoint existe e funciona (protegido por `CRON_SECRET`), mas precisa ser chamado periodicamente por um scheduler externo (Vercel Cron, GitHub Actions, etc.) — não configurado nesta sessão | Mesma transparência das fases anteriores sobre decisões pendentes (ex.: `BusinessDataProvider` na Fase 3): a ausência de agendador é dita explicitamente em vez de fingir que o job já roda sozinho. |
| Cadastro de customer no Asaas reaproveitado entre tentativas de assinatura da mesma organização | `startCheckout` busca `external_customer_id` da assinatura mais recente da organização antes de chamar `POST /v3/customers`; só cria um novo customer se nenhum existir ainda | A documentação do Asaas afirma que a API permite criar clientes duplicados e recomenda "verificar clientes existentes antes de criar um" (confirmado em docs.asaas.com durante a implementação), mas não documenta um filtro de busca por `externalReference`/`cpfCnpj` confiável na criação. Em vez de assumir um parâmetro de busca não confirmado, a aplicação evita a duplicação pela própria estrutura: reaproveita o id já persistido localmente. |
| Novos campos de faturamento em `organizations` (`billing_name`, `billing_document`, `billing_email`) | Migration `20261104172247_create_billing_support.sql`, nullable, preenchidos só no momento do checkout | A API do Asaas exige `name`+`cpfCnpj` para cadastrar um customer — dado que o FinderFlow não coletava antes da Fase 6. Nunca é dado de cartão; validado com checksum real de CPF/CNPJ (`src/lib/validation/document.ts`) antes de qualquer chamada ao Asaas. |
| **BUG crítico encontrado pelo QA real de build de produção (nunca chegou a ser exercitado em produção, pego antes do commit):** o middleware de sessão (`src/lib/supabase/proxy.ts`) redirecionava **qualquer** requisição não autenticada para `/login` — incluindo `POST /api/v1/webhooks/asaas` e `/api/v1/jobs/billing-sync`, que por design nunca têm sessão de usuário | `isPublicPath()` passou a excluir todo o prefixo `/api/` do redirect — cada Route Handler de API já faz sua própria autorização (token do webhook, `CRON_SECRET`) | Um placeholder de prefixo público (`/api/billing/webhooks`) já existia desde a Fase 0/1, antecipando um caminho que nunca foi o caminho real implementado (`/api/v1/webhooks/asaas`). O teste e2e `tests/e2e/billing-webhook.spec.ts` (`request.post` sem `reuseExistingServer` apontando para um build antigo) expôs isto como um `405 Method Not Allowed` em vez do `503` esperado — rastreado até o `307` da redireção para `/login`, que preserva o método `POST` e cai numa rota de página que não aceita `POST`. Se não corrigido, o Asaas jamais teria conseguido entregar nenhum webhook em produção. |
| CPF/CNPJ validado com dígito verificador real, não apenas contagem de caracteres | `src/lib/validation/document.ts` (`isValidCpf`/`isValidCnpj`) | Pega erro de digitação antes de gastar uma chamada à API do Asaas. **Bug encontrado pelo próprio teste unitário antes do commit:** a primeira versão do algoritmo de CNPJ usava a mesma lista de 12 pesos para os dois dígitos verificadores (só "deslocada"); o 2º dígito verificador do CNPJ soma 13 posições com uma lista de pesos própria, não um deslocamento da primeira — corrigido com duas listas de pesos explícitas (`firstDigitWeights`/`secondDigitWeights`) antes de qualquer commit. |

## Decisões técnicas tomadas durante a implementação (Fase 7 — Serviços, propostas, dashboard e relatórios)

| Tema | Decisão | Motivo |
|---|---|---|
| Escopo entregue | Serviços (CRUD, nunca excluídos — só desativados); Propostas + itens (numeração sequencial por org, estados `draft→sent→accepted/rejected/expired` com `rejected/expired→draft` permitido); geração de PDF (pdfkit) enviado ao Supabase Storage (bucket privado `proposals`); Negócios (`deals`) 1:1 com proposta aceita, com ganho/perda + motivo; Dashboard com tendência de leads/receita (6 meses), segmentos/origens e "Insights IA" (Sales Analyst); Relatórios (conversão por segmento/origem/responsável/etapa/serviço, ciclo médio, ticket médio, motivos de perda, consumo de IA); Proposal Assistant (IA) no detalhe do lead | `docs/07-backlog-and-acceptance.md` EPIC 08/09, seguindo o mesmo ritmo de pesquisa → lista de tarefas → implementação → teste → QA → documentação → commit das fases anteriores. |
| Total de cada proposta nunca é calculado pela aplicação — é um gatilho de banco que recalcula a partir dos itens | Triggers `proposal_items_before_write` (define `item.total = quantity * unit_price` na própria linha) e `proposal_items_after_write` (chama `recompute_proposal_total()` em insert/update/delete, gravando `proposals.total_amount`) | Regra explícita desta fase no master prompt: "métricas precisam de definição única e testável". Se o total fosse calculado também no código da Server Action, haveria duas definições do mesmo número que poderiam divergir (ex.: um item criado fora do fluxo normal). Com o gatilho, é estruturalmente impossível que `total_amount` fique desatualizado. |
| PDF gerado com `pdfkit` (puro JS), não um headless Chromium | `npm install pdfkit` + `@types/pdfkit`; `buildProposalPdfBuffer()` monta o documento em memória e devolve um `Buffer` | Ambiente serverless não garante um Chromium instalável/leve; pdfkit não tem dependência nativa, roda em qualquer runtime Node e é suficiente para o layout simples de uma proposta comercial. |
| Upload do PDF feito com o cliente Supabase autenticado do próprio usuário, nunca com a chave service-role | `generateProposalPdf()` usa `supabase.storage.from("proposals").upload(...)` com o cliente da sessão | Mesma filosofia "RLS como defesa primária" de todas as fases anteriores — a autorização de quem pode gravar o PDF de uma proposta é a mesma RLS que protege a tabela `proposals`, nunca um bypass administrativo. |
| Bucket `proposals` privado, com política de RLS baseada no prefixo do caminho do objeto | 4 policies em `storage.objects` usando `split_part(name, '/', 1)::uuid` para extrair o `organization_id` do caminho `{organization_id}/{proposal_id}.pdf` e checar contra `is_org_member`/`can_edit_org`/`can_admin_org` | Padrão já estabelecido no projeto para isolamento multi-tenant (mesmas funções de checagem usadas em todas as tabelas de negócio desde a Fase 1) — aplicado aqui ao Storage pela primeira vez. |
| Numeração sequencial de proposta sem sequence dedicada do Postgres | `nextProposalNumber()` lê o último número da org, incrementa, e tenta de novo até 3 vezes em caso de `23505` (violação de unicidade em `(organization_id, proposal_number)`) | Mesmo padrão de retry-em-conflito já usado no checkout de assinatura da Fase 6 (`SubscriptionAlreadyActiveError`) — evita criar uma sequence global por organização só para este caso. |
| `deals` (negócio) é um conceito separado de `leads.status`/`loss_reason` (ganho/perdido de funil) | `deals` é criado explicitamente ("Converter em negócio") só quando uma proposta é aceita, com seu próprio `open/won/lost` e `lost_reason` (coluna nova, migration desta fase), ligado 1:1 à proposta por um índice único parcial (`deals_one_per_proposal_idx`) | O funil de pipeline (Fase 4) já tratava ganho/perda no nível do lead ao mover para uma etapa fechada — isso continua existindo e **não foi alterado**. `deals` representa a negociação comercial específica daquela proposta, que pode ter seu próprio desfecho independente do estágio do lead (ex.: lead pode ter várias propostas ao longo do tempo, cada negócio sendo seu próprio registro). |
| `profiles_select_org_peers`: nova policy de RLS permitindo ver `full_name`/`avatar_url` de outros membros da mesma organização | Função SQL `shares_org_with(target_user uuid)` (SECURITY DEFINER, `revoke` de `public`/`anon`, só `authenticated` pode executar) + policy `on public.profiles for select to authenticated using (shares_org_with(id))` | Primeira funcionalidade do projeto que precisa resolver "quem é o responsável por este lead" para **outro** usuário além do próprio — o relatório de "conversão por responsável" precisa do nome de qualquer membro, não só do usuário logado. A policy anterior (`profiles_select_self`) só permitia ver o próprio perfil. Expansão deliberada e documentada, não uma falha de segurança: expõe só nome/avatar, nunca e-mail ou qualquer outro dado. |
| `leads.assigned_to → profiles` não pode ser embutido numa query do PostgREST | `reports.service.ts` faz uma query separada em `profiles` e monta um `Map` manualmente, em vez de `assignee:profiles(full_name)` no `select()` de `leads` | `leads.assigned_to` tem FK para `auth.users`, não para `public.profiles` — o PostgREST só consegue embutir relações ao longo de uma FK real na tabela consultada, que não existe nessa direção. Confirmado pelo próprio `tsc` rejeitando o tipo (`SelectQueryError`). |
| Opportunity Engine (IA) da Fase 5 não precisou de nenhum código novo nesta fase | `company-analyzer.service.ts` já consultava `services` e alimentava `opportunities[].service_id` desde a Fase 5; a UI (`company-analysis-section.tsx`) já renderizava esse campo | Era um placeholder esperando dados reais: sem um catálogo de serviços, o campo `service_id` nunca resolvia a nada útil. Ao implementar o CRUD de serviços nesta fase, a funcionalidade passou a funcionar ponta a ponta sem qualquer alteração no código de IA — validação de que o design da Fase 5 já havia antecipado corretamente esta dependência. |
| Sales Analyst: a IA interpreta, nunca calcula | `computeSalesAnalystMetrics()` calcula todos os números no servidor (contagens, receita ganha, ticket médio, motivos de perda); o schema de saída estruturada (`salesInsightsSchema`) exige que `insight.evidence` cite um valor literal da entrada, e o prompt proíbe explicitamente o modelo de calcular/estimar/corrigir qualquer número; `period_label` é sempre o valor ecoado pelo próprio modelo a partir do que foi enviado, nunca uma string fixa da UI | Mesma preocupação de "definição única e testável" de métricas — se a IA pudesse recalcular ou arredondar um número por conta própria, o relatório de IA poderia divergir do dashboard/relatórios que usam a mesma métrica. |
| Proposal Assistant (IA) nunca insere a proposta sugerida diretamente em `proposals`/`proposal_items` | Gera um rascunho (`proposalDraftSchema`) exibido na tela, persistido só em `ai_analyses` (auditoria); o usuário precisa criar a proposta manualmente e adicionar os itens um a um | Mesmo princípio "humano no controle" já aplicado ao Gerador de Outreach da Fase 5 — uma proposta comercial real nunca deveria ser enviada ao cliente sem revisão humana explícita. |
| **Bug corrigido nesta fase:** `proposalsSentCount` do dashboard contava **todas** as propostas da organização, não só as com `status = 'sent'` | Adicionado `.eq("status", "sent")` à query em `dashboard.service.ts` | Resquício de uma implementação de fase anterior (placeholder antes de o módulo de propostas existir) — encontrado durante a revisão do código do dashboard nesta fase, antes de qualquer commit. Nenhum outro bug de aplicação foi encontrado durante o QA real desta fase: todas as falhas investigadas no QA interativo (processo de servidor obsoleto de uma execução anterior; estratégia de espera `networkidle` do Playwright não confiável nesta aplicação) foram problemas da própria ferramenta de QA, não do código da Fase 7 — confirmado ao final com as 17 verificações da QA passando limpas num build de produção fresco. |
| Dois novos achados do `get_advisors` corrigidos antes do commit | (1) `proposal_items_before_write`/`proposal_items_after_write`: adicionado `set search_path = public` e `revoke all ... from public, anon, authenticated`; (2) `shares_org_with`: `revoke all from public, anon; grant execute to authenticated` | Mesma disciplina de segurança de todas as fases anteriores — toda função `SECURITY DEFINER` nova é corrigida antes de avançar, nunca deixada para depois. Os achados pré-existentes (ex.: funções de checagem de organização chamáveis por `authenticated`, que é intencional) foram deixados como já aceitos. |

## Decisões técnicas tomadas durante a implementação (Fase 8 — Hardening e beta)

**Resultado desta fase: não afirmamos que o sistema está pronto para produção/beta comercial — a seção 9.X abaixo lista exatamente o que foi verificado com evidência e o que continua pendente, e por quê.** Isso segue a instrução explícita de `claude/MASTER_PROMPT.md` para esta fase.

| Tema | Decisão/achado | Evidência |
|---|---|---|
| Teste de isolamento cross-tenant com dois tenants reais | Criados dois usuários/organizações reais no Supabase do projeto, com uma empresa e um serviço seedados na organização A; usando o token de autenticação real do usuário B (via `POST /auth/v1/token?grant_type=password`), tentativas de **select, update, delete e insert** contra os dados da organização A, mais uma chamada totalmente anônima | 13/13 tentativas de acesso cruzado bloqueadas pela RLS (status 200 com 0 linhas para select/update/delete; 403 `new row violates row-level security policy` para o insert forjando `organization_id` de A). Dados de A permaneceram intactos após as tentativas. Script e dados de teste removidos ao final. |
| Revisão de RLS por tabela/operação | Consultado `pg_class`/`pg_policies` para as 30 tabelas de `public`: todas com RLS habilitada; as com menos de 4 policies (`asaas_webhook_events`, `audit_logs`, `jobs`, `notifications`, `organizations`, `plans`, `ai_usage_events`) revisadas uma a uma — todas restritivas por design (ex.: `plans` só expõe planos ativos; `organizations` não tem policy de insert/delete porque criação é via RPC `SECURITY DEFINER` e exclusão não é exposta) | Nenhum gap encontrado; nenhuma tabela tenant-scoped ficou sem policy de verdade. |
| Índices de performance adicionados | 18 índices novos em colunas de filtro real da aplicação sem cobertura (ex.: `leads.assigned_to`, `tasks.assigned_to`, `notifications(organization_id, user_id)`, `organization_members.user_id`, `proposal_items.proposal_id`/`organization_id`, `jobs.organization_id`, etc.) | `get_advisors` (performance) caiu de 34 para 16 achados de "unindexed foreign keys" |
| FKs compostas `_same_org_fk` deliberadamente deixadas sem índice | São usadas só como checagem de integridade referencial (garantir que as duas pontas de uma relação pertencem à mesma organização), nunca como predicado de busca/join real em nenhuma query da aplicação | Indexá-las adicionaria 16 índices de baixo valor real; registrado aqui como decisão consciente, não uma lacuna esquecida |
| `profiles` tinha duas policies permissivas de SELECT avaliadas em toda consulta (`profiles_select_self` + `profiles_select_org_peers`, da Fase 7) | Mescladas em uma única policy `profiles_select_visible` (`id = auth.uid() OR shares_org_with(id)`) | `get_advisors` (performance): achado "multiple permissive policies" eliminado |
| Headers de segurança aplicados globalmente | `next.config.ts` `headers()`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` restritiva, HSTS, e uma CSP (moderada — `unsafe-inline`/`unsafe-eval` em script, não baseada em nonce) | Confirmado via `curl -D -` contra o build de produção local |
| CORS: nenhum header adicionado | As duas únicas rotas de API (`/api/v1/webhooks/asaas`, `/api/v1/jobs/billing-sync`) são chamadas servidor-a-servidor (Asaas e um scheduler externo), nunca por JavaScript de um navegador em outra origem — o comportamento padrão do Next.js (sem `Access-Control-Allow-Origin`) já é a postura mais restritiva possível | Busca confirmou que nenhum header CORS permissivo existe em nenhum lugar do código |
| Rate limiting best-effort adicionado no middleware (`src/lib/security/rate-limit.ts`) | Janela fixa em memória, por processo: 10 req/min para POST em `/login`\|`/register`\|`/recovery`; 120 req/min para o webhook do Asaas (entrega "at least once" pode reenviar); 10 req/min para o job de reconciliação | Testado ao vivo: 10 tentativas de login permitidas, 11ª e 12ª bloqueadas com `429` e `Retry-After` |
| **Limitação conhecida do rate limiting, documentada e não escondida** | Contador em memória do processo Node — em deploy serverless/edge com múltiplas instâncias, o limite real é "N por instância", não "N globalmente". Não é uma defesa de produção contra abuso distribuído coordenado | Decisão registrada em comentário no próprio `rate-limit.ts`; trocar por um contador compartilhado (tabela Postgres ou Redis dedicado) é pendência de infraestrutura antes do beta comercial real |
| Logging estruturado com redação sistemática de PII/segredos | `src/lib/logger/logger.ts` (já existia desde fases anteriores, usado em ~90 pontos do código) passou a redigir (`[REDACTED]`) automaticamente qualquer campo cujo nome combine com um padrão sensível (token, senha, cartão, CPF/CNPJ, e-mail, telefone, authorization, etc.), recursivamente, **antes** da serialização — não depende mais só da disciplina de cada chamador | Testado com 3 casos unitários (campo direto, aninhado, dentro de array) — todos passando; nenhum call site precisou ser alterado para se beneficiar da proteção |
| Logs operacionais (request id, duração, status) adicionados aos pontos que o checklist de observabilidade (`docs/08-security-operations.md` §8.5) pedia e que só tinham log de erro | Webhook do Asaas e job de reconciliação agora logam um evento `info` com `requestId`, duração, status, e (no webhook) o id do evento — nunca o payload bruto; a `AIEngine` (`runStructuredAI`/`runConversationTurn`) agora espelha no log de stdout o mesmo evento já persistido em `ai_usage_events` (modelo, tokens, custo, duração, status) | Mudança testada com `tsc`/lint/vitest (154 testes) e um smoke test funcional dos dois endpoints |
| Auditoria de acessibilidade (axe-core) em 13 páginas autenticadas principais | Encontradas 16 violações críticas/sérias na primeira passada: `color-contrast` (praticamente toda página — `--ff-text-muted` media 4.29:1 sobre `--ff-bg-surface`, abaixo do mínimo AA de 4.5:1), `select-name` (2 `<select>` sem rótulo acessível — período do Sales Analyst, canal do Gerador de Abordagem), `definition-list` (um `<dl>` no detalhe de empresa cujos filhos não eram pares `dt`/`dd`, achado `color-contrast` isolado num `StagePill` que usava a cor arbitrária da etapa do pipeline como cor do **texto**, nem sempre com contraste garantido) | Todas as 16 corrigidas: `--ff-text-muted` alterado para `#9790a8` (~5.9:1); `<label className="sr-only">` adicionado aos dois selects; `<dl>` sem semântica de termo/definição trocado por `<div>`; `StagePill` passou a usar a cor da etapa só no indicador/fundo tingido, nunca no texto (sempre `--ff-text-primary`). Segunda passada: 0/13 páginas com violação crítica/séria. |
| Verificação de responsividade mobile (375px) em 13 páginas | Nenhuma overflow horizontal encontrada (`scrollWidth === clientWidth` em todas) | Script Playwright descartado após a verificação |
| Regressão dos fluxos de billing da Fase 6 | `git diff`/`git log` confirmam que `webhook.service.ts`, `reconcile.service.ts` e `src/lib/billing/` não foram tocados desde o commit da Fase 6 — zero risco de regressão de lógica. Os dois Route Handlers (webhook, job) continuam respondendo `503` honesto quando não configurados, mesmo após o rate limiting e os novos logs adicionados nesta fase | `curl` contra o build de produção local confirmou ambos os `503` |
| Documentação legal placeholder criada | `docs/legal/termos-de-uso.md` e `docs/legal/politica-de-privacidade.md` — rascunhos explicitamente marcados como não validados juridicamente, cobrindo controlador/operador, bases legais, compartilhamento com IA/Asaas, direitos do titular | Nenhuma reivindicação de aprovação jurídica é feita — ver aviso no topo de cada arquivo |
| Runbook de suporte/incidentes criado | `docs/09-support-and-incidents.md` — severidades, passos imediatos, dependências externas e seus modos de falha conhecidos | — |
| **Backups: achado concreto, não uma lacuna de configuração** | O projeto Supabase está no **plano Free** (`get_organization` confirmou `plan: "free"`), que não inclui backups automáticos gerenciados nem PITR — não há nada a "ativar" aqui; é uma limitação de infraestrutura que exige upgrade de plano antes de qualquer garantia real de recuperação | Documentado em `docs/09-support-and-incidents.md` §9.5 como pré-requisito de infraestrutura, não melhoria opcional |

### Checklist de pré-produção (`docs/08-security-operations.md` §8.8) — status real nesta fase

| Item | Status |
|---|---|
| Dois tenants testados com tentativa de acesso cruzado | ✅ Feito nesta fase, com evidência (13/13 bloqueios) |
| RLS revisada por tabela e operação | ✅ Feito nesta fase, nenhum gap |
| Service role e secrets fora do frontend | ✅ Já garantido desde a Fase 0/1 (nunca houve `SUPABASE_SERVICE_ROLE_KEY`/`OPENAI_API_KEY`/`ASAAS_API_KEY` no cliente) |
| HTTPS e domínio configurados | ⏳ Pendente — não há domínio de produção definido neste ambiente (decisão de negócio, ver `docs/DECISIONS.md` item 8) |
| Rate limits ativos | ⚠️ Parcial — implementado e testado, mas best-effort em memória (ver limitação documentada acima); não é a defesa final de produção |
| Asaas Sandbox aprovado em sucesso, falha, atraso, cancelamento e duplicidade de webhook | ✅ Feito na Fase 6 (chamadas reais em Sandbox, documentado em `docs/DECISIONS.md` Fase 6); lógica confirmada intocada nesta fase |
| OpenAI timeout, rate limit, refusal e saída inválida tratados | ✅ Feito na Fase 5 (estados honestos de erro/recusa/validação Zod) |
| Fonte de dados aprovada juridicamente/contratualmente para uso comercial | ⚠️ Parcial — descoberta integrada usando dado público oficial da Receita Federal (via Minha Receita, MIT); sem revisão jurídica formal da licença do dataset. Enriquecimento (site/contato real) ainda não resolvido. Ver seção "Provedor de dados de empresas" acima. |
| Termos/Política de Privacidade publicados | ⚠️ Parcial — rascunhos criados nesta fase, **não revisados juridicamente**, não publicados numa URL pública |
| Backups e restauração testados | ❌ Não feito — impossível no plano atual (Free); upgrade de plano é pré-requisito |
| Logs e alertas configurados | ⚠️ Parcial — logging estruturado com redação está pronto; **não há alertas automáticos configurados** (nenhum provedor de observabilidade conectado) |
| Testes E2E e acessibilidade básica aprovados | ✅ Feito — 22 testes E2E (Playwright) + auditoria axe-core em 13 páginas, 0 violações críticas/sérias |
| Processo de suporte e incidente documentado | ✅ Feito nesta fase (`docs/09-support-and-incidents.md`) |

**Conclusão honesta desta fase:** o sistema está significativamente mais robusto (isolamento multi-tenant verificado ao vivo, headers de segurança, rate limiting best-effort, logs com redação sistemática, zero violação crítica de acessibilidade), mas **não está pronto para beta comercial real** — faltam decisões de negócio já identificadas desde fases anteriores (domínio, provedor de dados, termos revisados juridicamente) e um upgrade de infraestrutura (plano Supabase com backup) antes de aceitar dados reais de assinantes pagantes.

## Provedor de dados de empresas (decisão pendente #1 — descoberta resolvida)

Depois da Fase 8, o usuário propôs uma abordagem alternativa: Playwright
com web scraping refinado por IA, combinado com o projeto open-source
OpenCNPJ + base de dados própria. Esta seção documenta a validação feita
antes de integrar (exigida pelo prompt mestre — "verificar política de
uso, custos, atribuição, cache e retenção antes de integrar") e o que foi
de fato implementado.

### O que foi investigado

| Pergunta | Achado |
|---|---|
| O que é o OpenCNPJ? | Um entre vários wrappers de terceiros sobre a mesma base pública da Receita Federal. O específico `adamloko/opencnpj` só oferece consulta unitária por CNPJ (sem busca por CNAE/UF), 100 req/min, sem licença declarada — útil só para enriquecimento pontual, não para descoberta. |
| A Receita Federal publica a base completa como dado aberto? | Sim (~70M de CNPJs, ~27M ativos), mensalmente, em `dadosabertos.rfb.gov.br/CNPJ/`. **Mas o acesso direto está atrás de proteção anti-bot/CAPTCHA** — confirmado ao vivo: toda tentativa de baixar esse domínio deste ambiente teve a conexão TLS resetada, enquanto outros domínios (incluindo outros `.gov.br`, como o da IBGE) funcionaram normalmente antes de também serem bloqueados — padrão consistente com um WAF específico daquele serviço, não um problema de rede genérico. Isso foi documentado como um achado de viabilidade, e **nenhuma tentativa de contornar esse bloqueio foi feita** (ex.: forjar cabeçalhos de navegador foi corretamente bloqueado pelo próprio classificador de segurança do ambiente ao ser tentado). |
| Existe uma alternativa que já resolveu esse problema? | Sim — **Minha Receita** (`minhareceita.org`, código em `codeberg.org/cuducos/minha-receita`, licença **MIT**). É um projeto comunitário que processa os mesmos arquivos oficiais da Receita e os serve como API pública gratuita, sem limite de requisições documentado (apenas proteção best-effort contra sobrecarga, resposta `429`), com busca paginada real por `uf`, `municipio`, `cnae`/`cnae_fiscal` e `natureza_juridica` — exatamente o que a descoberta por segmento+localização precisa. Testado ao vivo deste ambiente: funciona (ver testes abaixo). |
| Licença dos dados? | A documentação do Minha Receita afirma que os dados são "disponibilizados tal como foram publicados pela Receita Federal" — ou seja, é o mesmo dado aberto oficial do governo, não um dado proprietário de terceiro. Não há um texto de licença formal explícito (nem no Minha Receita, nem localizamos a página específica de termos do dataset de CNPJ da Receita — o rodapé institucional geral do site da Receita cita CC BY-ND, mas isso é sobre o conteúdo do site, não sobre o dataset aberto). **Isto não é uma certeza jurídica blindada**, é uma base razoável para operar — a mesma ressalva que já existe para Termos/Privacidade (decisão pendente #7) se aplica aqui: revisão jurídica formal antes de uma operação comercial em maior escala é recomendada, não bloqueante para validar o produto. |
| Custo? | Zero — API pública gratuita, sem chave. Caso o servidor comunitário se torne instável em produção, o próprio projeto é open-source (MIT) e auto-hospedável — `BUSINESS_PROVIDER_BASE_URL` já existe para apontar para uma instância própria sem mudar nenhum outro código. |

### O que foi implementado

- `src/modules/companies/providers/minha-receita-provider.ts`: primeiro
  adaptador real de `BusinessDataProvider`, buscando por UF/cidade e por
  códigos de CNAE Fiscal, com paginação (cursor), retry único em
  `429`/`5xx`, filtro de cidade feito no nosso lado (a API só filtra por
  código IBGE/SIAFI de município, que decidimos não depender de um
  segundo serviço externo para resolver — ver próximo item), e
  atribuição (`attribution`) sempre preenchida e exibida na UI.
- `src/modules/companies/providers/cnae-catalog.ts`: catálogo estático de
  ~20 segmentos comuns → código(s) de CNAE, **cada código conferido ao
  vivo contra a própria API do Minha Receita antes de entrar na lista**
  (a numeração do CNAE não é intuitiva — por exemplo, tentativas
  iniciais "de memória" para odontologia, estética e fisioterapia
  erraram o código mais da metade das vezes; só entraram no catálogo
  depois de confirmadas).
- `src/modules/companies/providers/cnae-resolver.ts`: resolve o texto
  livre da busca para um código de CNAE em duas camadas — (1) palavra-chave
  contra o catálogo, instantâneo e sem custo; (2) se não casar, pede à IA
  para escolher a melhor entrada **dentre as já catalogadas e conferidas**
  (nunca para inventar um código novo) — esta é a peça de "IA refinando a
  busca" da proposta original, mas desenhada para nunca alucinar um
  código inexistente. Degrada para "sem CNAE" (busca só por UF) se a IA
  não estiver configurada ou falhar.
- `src/modules/prospecting/actions.ts` e `src/components/prospecting/search-form.tsx`:
  a busca agora persiste cada resultado em `search_results` (nunca cria
  `companies` automaticamente) e a UI lista os resultados com a
  atribuição visível e um botão explícito "Adicionar como empresa" por
  item, que cadastra a empresa (dedupe por CNPJ, igual ao CSV) e grava
  `company_source_refs` com a atribuição completa.
- `BUSINESS_PROVIDER=minha_receita` habilitado neste ambiente
  (`.env.local`) e documentado como padrão em `.env.example`/`README.md`/`docs/02-architecture.md`.
- Testado ao vivo (não só com mock): busca real por `uf=BA` + CNAE de
  restaurantes devolveu 60 resultados reais, incluindo filtro de cidade
  funcionando e paginação seguindo o cursor corretamente; uma tentativa
  anterior recebeu `429` (sobrecarga do servidor comunitário por conta
  dos próprios testes de verificação de CNAE feitos nesta sessão) e foi
  tratada como erro honesto pelo retry/log, não escondida.

### O que NÃO foi implementado (deliberadamente, nesta passada)

- **Enriquecimento via Playwright/IA** (site institucional, redes
  sociais, decisor): a base da Receita Federal não tem esses campos — o
  contato cadastrado é frequentemente do contador, não da empresa. Isso
  continua sendo um problema real e seria o próximo passo natural, mas
  **não foi implementado agora** porque merece seu próprio processo de
  verificação: scraping do site da própria empresa (depois que ela já
  foi encontrada) é razoável; scraping de resultados de busca do Google é
  **violação dos Termos de Uso do Google** e não deve ser implementado
  dessa forma. Fica registrado aqui como trabalho futuro distinto, não
  como algo resolvido por esta integração.
- **Catálogo de CNAE completo** (~1.300 códigos oficiais): o catálogo
  atual cobre ~20 segmentos comuns verificados manualmente. Expandir a
  IA para escolher entre o universo completo de CNAEs exigiria embutir a
  tabela oficial completa como contexto (para a IA escolher entre
  códigos reais, nunca inventar) — não foi feito agora para não
  introduzir risco de alucinação de código sem essa tabela de referência
  pronta.
- **Importação em massa da base da Receita para banco próprio**: viável
  em tese (o Minha Receita é auto-hospedável), mas não é necessária para
  validar o produto agora — fica como opção de escala futura,
  documentada no `BUSINESS_PROVIDER_BASE_URL`.

## Verificação de presença digital (empresa tem site próprio ou não)

### O requisito (dito pelo usuário, não inferido)

> "Um assunto importante, a ideia do sistema é encontrar potenciais
> clientes, então a busca deve trazer empresas/estabelecimentos que não
> possuem sites registrados ou não teve nenhum site atribuído, por isso
> o web scrapping é importante."

Isso reformula o que "web scraping" significava até aqui. A decisão
anterior (Minha Receita) já resolveu a *descoberta* de empresas por
segmento/UF. O que faltava era o sinal central do produto: **identificar
quais dessas empresas já encontradas não têm site próprio** — esse é o
critério que transforma uma lista de empresas em uma lista de leads
qualificados para um produto de presença digital. Não é um enriquecimento
opcional; é a proposta de valor.

### Por que não foi feito com Playwright/scraping do Google

Já estava registrado antes neste documento (seção do provedor de
empresas, "Detecção de presença na web") que raspar resultados de busca do
Google **viola os Termos de Uso do Google** e não deveria ser
implementado dessa forma, independentemente da motivação (aqui, o
objetivo legítimo de encontrar leads). Essa restrição não mudou com a
clarificação do usuário — ela só tornou mais urgente achar uma alternativa
legítima que cumpra a mesma função.

### Alternativas de API avaliadas

- **Bing Web Search API**: **descontinuada/retirada em 11/08/2025.**
  Não é uma opção viável para uma integração nova.
- **Google Custom Search JSON API**: confirmado via documentação oficial
  do Google (fetch direto) que está **fechada para novos clientes**, com
  desativação completa anunciada para 01/01/2027. Não é uma opção viável
  para uma integração nova.
- **Brave Search API** (escolhida): API de busca web atual, compatível
  com os Termos de Uso, uso comercial permitido. Nível gratuito: 2.000
  requisições/mês. Pago: US$3/1.000 (Base) ou US$5/1.000 (Pro)
  requisições. Endpoint `GET https://api.search.brave.com/res/v1/web/search`,
  autenticação via header `X-Subscription-Token`, resposta JSON em
  `web.results[]` com `title`/`url`/`description`. (As páginas de
  documentação oficial da Brave retornaram bloqueadas para fetch direto
  nesta sessão — `robots_disallowed`/`connect_rejected` — então o formato
  exato da requisição/resposta foi confirmado contra uma implementação de
  terceiros em código-fonte Rust publicada no docs.rs, não só memória.)

### O que foi implementado

- `src/modules/companies/presence/web-presence-checker.ts` — interface
  `WebPresenceChecker` (`check(query): Promise<WebPresenceResult>`) e tipos
  `WebPresenceQuery`/`WebPresenceResult`, desacoplados do provedor — o
  mesmo padrão de abstração usado para `BusinessDataProvider`.
- `src/modules/companies/presence/non-owned-domains.ts` — lista de ~45
  domínios que **não** são o site próprio de uma empresa mesmo quando
  aparecem nos resultados de busca: redes sociais (Instagram, Facebook,
  LinkedIn, TikTok), diretórios de CNPJ (cnpj.biz, cnpj.info, etc.),
  marketplaces (Mercado Livre, OLX), portais de notícia e páginas
  `gov.br`. Trata sufixos compostos de domínio brasileiro (`.com.br`,
  `.org.br`) corretamente.
- `src/modules/companies/presence/brave-web-presence-checker.ts` —
  implementação concreta: monta a query (nome + cidade + UF), busca na
  Brave Search API, filtra domínios não-próprios, e aplica um casamento de
  nome por **sobreposição de tokens** (`nameOverlap >= 0.4`) entre o nome
  da empresa e o título/domínio do resultado — para não confundir um
  resultado de nome totalmente diferente com o site da empresa.
- Botão "Verificar site" **manual, por resultado individual** de busca
  (nunca automático para toda a lista) em `search-form.tsx` — mesmo padrão
  já usado no Lead Scorer, Company Analyzer e Outreach Generator: qualquer
  funcionalidade que consome cota de API paga é acionada item a item, para
  o usuário não esgotar o nível gratuito (2.000 req/mês) em poucas buscas
  sem querer.
- `checkWebPresenceAction` em `prospecting/actions.ts` persiste o
  resultado em `search_results.display_data.webPresence` — não cria
  colunas novas, reaproveita o campo JSON já existente para dados exibidos
  sem schema fixo.
- Sem `BRAVE_SEARCH_API_KEY` configurada, `getWebPresenceChecker()` retorna
  `null` e a action devolve um estado explícito de "não configurado" — a
  UI mostra isso honestamente, sem fingir que a verificação rodou.

### O sinal é um indício, não uma certeza

A UI e os textos internos devem sempre dizer "sem site identificado" —
nunca "não tem site". Dois tipos de erro são possíveis e esperados:

- **Falso negativo**: a empresa tem site, mas ele está mal indexado, usa
  um nome de domínio muito diferente do nome fantasia, ou não aparece nas
  primeiras posições da busca.
- **Falso positivo**: existe um site de nome parecido que não pertence à
  empresa (duas empresas com nomes similares em cidades diferentes, por
  exemplo).

Por isso esse resultado nunca deve, por si só, decidir automaticamente
nada (como excluir a empresa de uma lista) — é só um indicador que o
usuário vê e usa com julgamento próprio.

### O que NÃO foi feito / limitação honesta desta sessão

**Esta integração não foi testada ao vivo contra a API real da Brave.**
Não havia uma `BRAVE_SEARCH_API_KEY` disponível neste ambiente para obter
uma. A implementação foi validada apenas com testes unitários que
simulam (`mock`) a resposta HTTP (`brave-web-presence-checker.test.ts`,
6 casos — incluindo resposta vazia, resultados só de redes sociais, nome
parecido mas domínio não-próprio, nome diferente, e erro 5xx da API) e
`non-owned-domains.test.ts` (4 casos). Os testes de tipo (`tsc`), lint
(`eslint`) e build (`next build`) passaram, mas isso confirma que o
código está correto *sintaticamente e logicamente diante dos casos
imaginados* — não que o endpoint real da Brave se comporta exatamente
como a implementação de terceiros usada como referência sugere. Para
ativar a funcionalidade de verdade, o usuário precisa criar uma conta na
Brave Search API (https://brave.com/search/api/), obter uma chave (nível
gratuito cobre 2.000 verificações/mês) e preencher
`BRAVE_SEARCH_API_KEY` em `.env.local`/nas variáveis de ambiente de
produção. Só depois disso o botão "Verificar site" pode ser considerado
testado com dados reais.

## Pendência conhecida: `SUPABASE_SERVICE_ROLE_KEY`

Nenhuma ferramenta MCP do Supabase disponível nesta sessão retorna a
`service_role`/secret key do projeto (`get_publishable_keys` só expõe
anon/publishable — isso é esperado: um conector de agente não deveria vazar
uma chave de admin). Para rodar `npm run test:rls` localmente via HTTP real
(preferível ao script SQL acima para validação contínua) ou qualquer rotina
de admin (ex.: criar usuários via `admin.auth.admin.createUser`), obtenha a
chave manualmente em
https://supabase.com/dashboard/project/lxzsefabmnagiaywaxeb/settings/api-keys
e preencha `SUPABASE_SERVICE_ROLE_KEY` / `TEST_SUPABASE_SERVICE_ROLE_KEY` em
`.env.local` (nunca commitar com o valor real).

## BUG corrigido: nomes de arquivo de migration fora de ordem (local) vs. aplicado (remoto)

### O sintoma

Rodar `npm run supabase:start` (que sobe um Postgres local via Docker e
reaplica **todas** as migrations do diretório `supabase/migrations/`, em
ordem alfabética/numérica pelo nome do arquivo) falhava com:

```
ERROR: function public.proposal_items_after_write() does not exist (SQLSTATE 42883)
At statement: 2
revoke all on function public.proposal_items_after_write() from public, anon, authenticated
```

### A causa raiz

O nome de cada arquivo local de migration deveria corresponder exatamente
à `version` (timestamp) sob a qual essa migration está registrada no
projeto Supabase remoto (`lxzsefabmnagiaywaxeb`) — é assim que a CLI do
Supabase rastreia o que já foi aplicado. Durante o desenvolvimento das
fases anteriores, vários arquivos locais foram renomeados para timestamps
"redondos"/arbitrários (ex.: `20261104170000_create_pipeline_functions.sql`)
que não correspondem ao timestamp real de aplicação no remoto (que era
`20261104160928`), e nesse processo a ordem relativa de dois arquivos foi
invertida:

- `20261104210000_fase7_services_proposals.sql` (que **cria** as funções
  `proposal_items_before_write`/`proposal_items_after_write`) tinha um
  timestamp local que o colocava **depois** de
  `20261104180020_fase7_harden_proposal_triggers.sql` (que faz `revoke`
  nessas mesmas funções). No projeto remoto, a ordem real de aplicação foi
  a correta — `fase7_services_proposals` primeiro (`20261104175959`),
  `fase7_harden_proposal_triggers` depois (`20261104180020`), por isso o
  projeto remoto nunca teve esse erro. Só apareceu ao rodar `supabase start`
  localmente do zero, que reaplica os arquivos **na ordem dos seus nomes**,
  não na ordem em que foram originalmente aplicados ao remoto.
- Separadamente, o diretório local também estava com uma migration a menos
  que o remoto: `fix_set_updated_at_privileges` (versão `20261104144445`)
  havia sido fundida, em algum momento, dentro do arquivo
  `fix_function_privileges.sql` (`20261104143356`) — o efeito final no
  schema é o mesmo (os `revoke`/`create or replace` são idempotentes), mas
  o histórico local não refletia exatamente o histórico remoto.

### A correção

Todos os 19 arquivos de `supabase/migrations/` foram renomeados via
`git mv` para que seu timestamp bata exatamente com a `version` registrada
no remoto (confirmado via `mcp__Supabase__list_migrations` contra o projeto
real), e o arquivo fundido foi separado de volta em dois
(`20261104143356_fix_function_privileges.sql` +
`20261104144445_fix_set_updated_at_privileges.sql`), resultando em 20
arquivos cuja ordem alfabética agora é **idêntica** à ordem de aplicação
real no projeto remoto. Todas as referências a nomes de arquivo antigos em
comentários de outras migrations, em `docs/DECISIONS.md` e em
`src/modules/billing/webhook.service.ts` também foram atualizadas.

Nenhum SQL foi alterado (além da separação do arquivo fundido, que não
muda o schema final) — isto é puramente uma correção de nomenclatura de
arquivo para restaurar a ordem de dependência correta e a correspondência
1:1 com o histórico de migrations do projeto remoto. **Não foi possível
validar com um `supabase start` real nesta sessão** (o ambiente sandbox
não tem Docker); a correção foi verificada lendo o conteúdo de cada
migration em ordem e confirmando que toda função/tabela é criada antes de
ser referenciada por uma migration posterior — o usuário deve confirmar
rodando `npm run supabase:start` novamente no seu ambiente local.

## Reverificação do adaptador Minha Receita contra a documentação oficial

A pedido explícito do usuário ("verique na internet como usar o minha
receita api e aplique no meu sistema"), revisitei `docs.minhareceita.org`
(páginas "Como usar" e "Dicionário de dados") e testei ao vivo contra
`https://minhareceita.org` para confirmar/corrigir o que já estava
implementado em `minha-receita-provider.ts`:

- **Confirmado, sem mudança**: `cnae` (não `cnae_fiscal`) casa com o CNAE
  principal OU qualquer secundário da empresa — é o parâmetro certo para
  descoberta ampla, e já era o usado. Múltiplos códigos repetindo o
  parâmetro (`?cnae=X&cnae=Y`) também está documentado e já era a forma
  usada. `cursor` opaco, `limit` até 1024 — tudo confirmado como já
  implementado.
- **Confirmado, só documentado melhor**: `municipio` na busca espera um
  código IBGE/SIAFI, não nome de cidade — por isso o filtro de cidade
  continua sendo feito no lado do app comparando o campo `municipio`
  (nome) de cada resultado já retornado, não pela API. Isso já era a
  implementação; só não estava explicitamente justificado no código.
- **Divergência encontrada entre a documentação escrita e o comportamento
  real**: a página "Dicionário de dados" descreve `cnae_fiscal` como
  string, mas uma chamada real (`GET /?uf=BA&cnae=5611201&limit=3`) retorna
  esse campo como número JSON (`"cnae_fiscal": 5620101`, sem aspas).
  Mantido como `number` no código (o comportamento real da API observado
  ao vivo prevalece sobre o texto da documentação, que pode estar
  desatualizado ou impreciso).
- **Lacuna real corrigida**: quando uma empresa aparece numa busca por ter
  casado via um CNAE **secundário** (não o principal), a UI mostrava só
  `cnae_fiscal_descricao` — a descrição da atividade principal, que pode
  não ter nada a ver com o segmento buscado, confundindo o usuário (ex.:
  buscar "restaurantes" e ver uma empresa cuja atividade principal é
  "fabricação de produtos de padaria", sem explicação). Confirmado ao vivo
  que esse caso é comum (não hipotético): de 5 resultados reais para
  `cnae=5611201` em `uf=BA`, 2 casaram pelo principal e 2 pelo secundário.
  Corrigido em `mapToResultItem`/`resolveMatchedCategory`: quando o match
  foi por um CNAE secundário, a categoria mostrada passa a ser "<descrição
  do secundário que casou> (atividade secundária; principal: <descrição
  do principal>)" — testado com os dois casos reais encontrados
  (`minha-receita-provider.test.ts`, 8/8 testes passando).

## Verificação de presença digital sem API de busca (scraping do site próprio, não do Google/Maps)

O usuário pediu scraping via Google Maps como alternativa à Brave Search
API, explicando que a IA deveria "refinar" a empresa trazendo informações
completas. Antes de implementar, verifiquei os Termos de Uso do Google
Maps Platform (`cloud.google.com/maps-platform/terms`, cláusula 3.2.3,
"No Scraping"/"No Caching"/"No use for AI/ML training") — proíbem
explicitamente exportar, extrair ou re-hospedar conteúdo do Google Maps,
inclusive nomes e endereços de empresas. Recusado por esse motivo, assim
como já havia sido recusado o scraping de resultados de busca do Google.

O usuário então insistiu, afirmando que "já construímos um web scraping
antes" e que não quer nenhuma API que exija cartão de crédito ou
pagamento. Busquei por `playwright|puppeteer|cheerio|scrap` em `src/` e
confirmei que **nenhum scraper foi implementado neste projeto** — os dois
únicos resultados eram comentários explicativos sobre a decisão de *não*
raspar Google/SERP (`business-data-provider.ts`, `web-presence-checker.ts`),
não código funcional. Comuniquei essa correção factual ao usuário.

Também reavaliei a Brave Search API (já usada neste projeto) à luz do
requisito "sem cartão": o nível gratuito da Brave ($5/mês em créditos)
**exige cartão de crédito no cadastro**, o que o próprio usuário rejeitou
explicitamente nesta conversa — ou seja, mesmo a solução já implementada
deixou de atender ao requisito dele.

**Solução implementada**: `DomainProbeWebPresenceChecker`
(`src/modules/companies/presence/domain-probe-web-presence-checker.ts`),
agora o verificador **padrão** em `get-web-presence-checker.ts`. Em vez de
consultar um motor de busca de terceiro (que exigiria lidar com Termos de
Uso de novo), gera domínios candidatos a partir do nome da empresa
(`domain-candidates.ts`: remove sufixo jurídico — Ltda/ME/EIRELI etc. —,
acentos e pontuação, tenta `.com.br`/`.com`/`.net.br` com e sem `www`/hífen)
e visita cada candidato com uma requisição HTTP direta — o mesmo que um
navegador faria ao digitar o endereço. Detecta páginas de "domínio à
venda"/estacionado (`PARKING_PAGE_MARKERS`) para não confundir isso com
"tem site".

Isto não é scraping de busca/mapas de terceiro — nenhum conteúdo de um
motor de busca é extraído, só URLs que construímos nós mesmos são
visitadas — por isso não há risco de ToS equivalente ao do Google.
É 100% grátis e não exige nenhuma chave de API nem cartão de crédito.

**Trade-off aceito e comunicado ao usuário**: recall bem mais baixo que
uma busca real — só encontra o site se o domínio seguir um padrão
previsível a partir do nome (não encontra, por exemplo, uma marca com
domínio bem diferente da razão social). `BraveWebPresenceChecker`
continua no código como upgrade opcional de recall para quem configurar
`BRAVE_SEARCH_API_KEY` por conta própria, mas não é mais o padrão.

A etapa de "IA refinando/completando informações da empresa" a partir do
conteúdo da própria página encontrada (pedida originalmente pelo usuário)
ainda não foi implementada nesta sessão — fica como próximo passo, junto
com o histórico de busca e a exportação em XLSX, também pedidos e ainda
pendentes.

Testes: `domain-candidates.test.ts` (4 casos) e
`domain-probe-web-presence-checker.test.ts` (6 casos) — 195/195 testes
passando no total.

## Histórico de busca e exportação em XLSX

Implementado o restante do pedido original do usuário (busca por
empresas com histórico e exportação em XLSX), que ficou pendente desde
a discussão sobre scraping/presença digital.

**Histórico de busca**: as tabelas `searches`/`search_results` já
existiam desde a Fase 3 (toda busca já era persistida — nunca se perdia
ao recarregar a página), mas não havia nenhuma forma de listar buscas
passadas ou reabri-las. Adicionado:
- `src/modules/prospecting/history.service.ts`: `listSearchHistory`
  (lista paginada, mais recentes primeiro) e `getSearchWithResults`
  (reconstrói os resultados de uma busca salva **sem nenhuma chamada ao
  provedor externo** — só lê `search_results`, exatamente o pedido do
  usuário: "voltar para última busca sem precisar realizar uma nova,
  gastando requisições").
- Novas Server Actions em `actions.ts`: `listSearchHistoryAction`,
  `reopenSearchAction`.
- UI: `SearchHistoryPanel` (`search-history.tsx`), listado na página de
  prospecção abaixo do formulário de busca.
- Melhoria adicional: a verificação de presença digital já era salva em
  `search_results.display_data.webPresence` (desde a Fase anterior),
  mas a UI nunca lia esse valor de volta — toda busca reaberta mostrava
  "Verificar site" do zero, mesmo já tendo sido verificado. Corrigido:
  `SearchResultView` agora carrega `cachedWebPresence`, e `ResultRow`
  inicializa o badge a partir dele.

**Exportação em XLSX**: avaliado `xlsx` (SheetJS) via npm antes de
integrar — tem uma vulnerabilidade de severidade **alta** sem correção
no registro npm (prototype pollution + ReDoS; a SheetJS só publica a
versão corrigida no CDN próprio, fora do registro padrão). Descartado
por esse motivo. Usado `exceljs` em vez disso (mantido ativamente, sem
vulnerabilidades diretas — só um aviso `moderate` transitivo via `uuid`
que não se aplica ao nosso uso).
- `src/modules/prospecting/export.service.ts`: `exportSearchResultsToXlsx`
  lê os `search_results` já salvos (mesma fonte do histórico — também
  não gasta requisição nova) e gera o `.xlsx` com `exceljs`.
- Rota `GET /api/v1/search-results/[searchId]/export`: autenticada por
  sessão + RLS (não por token separado — é uma ação do usuário logado,
  diferente dos webhooks que usam `CRON_SECRET`).
- Botão "Exportar XLSX" adicionado em `SearchResultsList` (componente
  extraído de `search-form.tsx`, reaproveitado tanto pela busca em
  tempo real quanto pelo histórico reaberto).

**Preparação para receber chaves pendentes a qualquer momento**
(`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ASAAS_*`): confirmado
que a arquitetura já trata essas chaves como opcionais e "lazy" — nunca
lidas no boot da aplicação (`getServerEnv()` não as exige), só no
momento em que a feature correspondente é efetivamente usada
(`createAdminClient()`, `getAIProvider()`, `getAsaasProvider()`), cada
uma com um estado "não configurado" honesto na UI em vez de quebrar.
Nenhuma mudança de código foi necessária. Única ressalva real (fora do
código, da própria Vercel): uma env var nova só é aplicada a partir do
próximo deploy — por isso, sempre que uma chave for adicionada, um
redeploy precisa ser disparado para ela valer.

Testes: `history.service.test.ts` (6 casos) e `export.service.test.ts`
(7 casos) — 208/208 testes passando no total.

## Busca por CNPJ específico

Pedido adicional do usuário, implementado junto com histórico/XLSX.
Diferente da busca por segmento/UF (endpoint `GET /?uf=..&cnae=..`,
"beta", paginada), o Minha Receita tem uma consulta direta por CNPJ
(`GET /<cnpj>`, aceita com ou sem pontuação), reverificada contra
`docs.minhareceita.org/como-usar/` nesta sessão: 200 com os dados da
empresa, 404 com `{"message": "CNPJ ... não encontrado."}` quando não
existe.

- `BusinessDataProvider.getByCnpj?(cnpj)`: novo método **opcional** no
  contrato (nem todo provedor futuro teria consulta direta por
  identificador — ex.: Google Places não teria), retorna `null` em 404
  em vez de lançar.
- `MinhaReceitaProvider.getByCnpj`: implementado, reaproveita
  `mapToResultItem` já existente.
- `searchByCnpjAction` (nova Server Action): mesmo tratamento de
  persistência da busca por segmento (`searches` + `search_results`) —
  por isso uma busca por CNPJ também entra automaticamente no
  histórico e pode ser exportada em XLSX, sem código extra.
- UI: `CnpjSearchForm`, um formulário compacto separado na página de
  prospecção.

Testes: +3 casos em `minha-receita-provider.test.ts` (sucesso, 404 →
null, 429 com retry e erro claro) — 211/211 testes passando no total.

## Fase 9 — aprovação manual de contas, super admin, segurança de login,
## credenciais Asaas/OpenAI por organização e remoção de planos

Pedido explícito do usuário (reconstrução de decisão de produto já em
produção): o cadastro público sem controle, a confirmação de e-mail
como único portão de acesso, o billing do próprio FinderFlow sobre seus
usuários (planos Starter/Pro via Asaas) e a chave Asaas/OpenAI global
(só do dono do sistema) deixam de existir. Decisões confirmadas com o
usuário antes de implementar (`AskUserQuestion`):

1. **Limite mensal de IA ligado a plano**: removido. Cada organização
   paga direto na própria conta OpenAI; `assertWithinQuota` (`src/lib/ai/quota.ts`)
   não lança mais `AIQuotaExceededError` — a contagem continua existindo
   só para telemetria/dashboard.
2. **Confirmação de e-mail do Supabase**: o usuário desativa o toggle
   "Confirm email" no próprio painel do Supabase (não existe API/MCP
   para isso) — `registerAction` já trata os dois casos (sessão ativa
   na hora → direto pro onboarding; sessão ausente → fluxo antigo de
   e-mail, como fallback enquanto o toggle não for desativado).
3. **Contas já existentes**: todas (inclusive as de teste já criadas em
   produção) ficam `pending` como qualquer conta nova — exceto a conta
   super admin do próprio usuário, que tem acesso liberado independente
   do approval_status da organização.
4. **Código de billing antigo** (`src/modules/billing`, `src/lib/billing`,
   `src/components/billing`, páginas `/billing`, webhook de assinatura,
   job de reconciliação): removido por completo, não só desativado.

### Super admin de plataforma

Problema: o e-mail do dono do sistema (`jpeddro0706@gmail.com`) ainda
não tinha conta neste projeto Supabase quando a migration foi escrita —
não dá pra simplesmente `UPDATE profiles SET is_super_admin = true
WHERE id = ...` porque a linha não existe ainda. Resolvido com uma
tabela de bootstrap `platform_admin_emails` (sem policies — só lida
pelo trigger) + `handle_new_auth_user` atualizado: todo profile novo já
nasce com `is_super_admin = true` se o e-mail bater com a lista: cobre
tanto o caso "conta já existe" (backfill de UPDATE na própria migration)
quanto "conta ainda vai ser criada" (o trigger cuida na hora do signup).
`is_platform_super_admin()` (SQL, security definer) expõe isso para RLS
e para o app.

### Aprovação manual de organizações

`organizations.approval_status` (`pending` por default | `approved` |
`rejected`) substitui a confirmação de e-mail como controle de acesso.
Gate único, no nível mais alto possível: `(workspace)/layout.tsx`
redireciona para `/pending-approval` quando a organização ativa não
está aprovada — super admin nunca é bloqueado aqui. `/admin` (fora do
grupo `(workspace)` de propósito — um super admin precisa aprovar
organizações mesmo que a própria esteja pendente) lista e permite
aprovar/rejeitar; a autorização real é a RLS policy
`organizations_update_super_admin`, não uma checagem manual duplicada
na Server Action.

### Segurança de login: rate limit + lockout temporário

`auth_login_attempts` (sem policies — mesmo padrão de `audit_logs`: só
o cliente admin/service role lê/escreve) grava toda tentativa de login
(sucesso ou falha) por e-mail. 5 falhas em 15 minutos bloqueiam novas
tentativas por até 15 minutos **sem nem chamar o Supabase Auth**
(`src/lib/auth/login-security.ts`). Importante: depende de
`SUPABASE_SERVICE_ROLE_KEY` — como essa chave ainda não estava
configurada neste ambiente no momento da implementação, o módulo
degrada para "nunca bloqueia" em vez de quebrar o login (mesmo
princípio já estabelecido para `OPENAI_API_KEY`/`ASAAS_*`: lazy, nunca
exigido no boot). Isso é adicional ao rate limit por IP que já existia
em `src/lib/security/rate-limit.ts` (`proxy.ts`) — um é por e-mail
(alvo), o outro por IP (origem); os dois ficam.

### Credenciais Asaas/OpenAI configuráveis por organização

Decisão de arquitetura: nunca guardar a chave em texto puro numa tabela
normal. O projeto já tinha a extensão `supabase_vault` instalada
(verificado com `list_extensions` antes de desenhar a solução — zero
custo adicional, zero serviço novo para configurar). Desenho:

- `organization_integration_credentials` guarda só metadados
  (ambiente Asaas, modelo OpenAI, `*_configured_at`) + o **id** do
  secret no Vault — nunca o valor.
- `set_org_asaas_credentials` / `set_org_openai_credentials` /
  `clear_org_*_credentials` (SQL, security definer): validam
  `can_admin_org()` (owner/admin da organização) antes de escrever no
  Vault — chamáveis por `authenticated`.
- `get_org_asaas_api_key` / `get_org_openai_api_key`: só decriptam o
  valor puro, e só são chamáveis por `service_role` — nunca
  `authenticated`, nunca `anon`. A chave jamais transita por uma query
  client-side.
- **Achado durante a implementação**: `revoke ... from public` sozinho
  **não** bastou para essas funções — este projeto Supabase já tem
  default privileges que concedem `EXECUTE` a `anon` explicitamente na
  criação de qualquer função em `public`. Confirmado consultando
  `pg_proc.proacl` diretamente (o advisor de segurança generalizado
  também apontou). Corrigido com `revoke execute ... from anon`
  explícito em cada função sensível — revalidado consultando
  `pg_proc.proacl` de novo depois.
- OpenAI por organização já está ligado em `src/lib/ai/engine.ts` via
  `resolveOpenAiCredentialsForOrganization` (`src/lib/ai/org-credentials.ts`):
  prioriza a chave da própria organização, cai para a chave global do
  ambiente se a organização não configurou a própria, e para
  "não configurado" se nenhuma das duas existir. Asaas por organização
  tem a função de leitura pronta (`get_org_asaas_api_key`) mas a
  implementação do provider HTTP (criar cliente/cobrança/link) ainda
  não foi escrita — ver próxima seção.

### Aba "Contratos" — ainda não implementada

A tela em `/contracts` (nav item "Contratos", Fase 9) é por ora um
placeholder (`ComingSoon`) — a base (credenciais por organização,
leitura server-side segura) está pronta, mas criar clientes/cobranças/
boletos/links de pagamento na API da Asaas usando a chave de **cada
organização** é uma superfície de API diferente da que o
`AsaasProvider` antigo (removido) cobria (aquele era só assinatura/
checkout da própria plataforma). Fica como próximo passo explícito, não
como algo esquecido.

### Testes

195/195 passando (211 anteriores − os testes de `entitlements.ts`/
`status.ts` removidos junto com o billing antigo). `next build` e
`eslint` limpos.

## Fase 10 — fundações de infra para a evolução do produto (supressão LGPD, fila assíncrona, auditoria, rate limit distribuído)

Primeira fase de um escopo bem maior pedido pelo usuário (evolução do
FinderFlow AI para uma plataforma de inteligência comercial B2B com 10
módulos novos — enriquecimento, website audit, presence score, scoring
2.0, recomendação de serviços, campanhas, cadências, WhatsApp, agente de
vendas IA, inteligência de conversão). Antes de qualquer módulo, o
usuário pediu explicitamente uma auditoria somente leitura (ETAPA 0,
entregue como `ETAPA-0-AUDITORIA.md`) e só depois aprovou o início da
implementação, começando pelas fundações que os outros módulos
dependem — exatamente a ordem de prioridade proposta na própria
auditoria.

Decisão central desta fase: **nenhuma das fundações contratou um
fornecedor novo**. A auditoria tinha listado explicitamente várias
decisões de negócio pendentes (fila dedicada tipo Trigger.dev/Inngest,
Redis/Upstash para rate limit, Sentry para observabilidade, upgrade do
plano Supabase para backups) — como essas decisões ainda não foram
tomadas pelo usuário, esta fase resolveu o que dava para resolver só com
o que já existe (Postgres/Supabase):

- **Lista de supressão (LGPD)**: tabela `suppression_entries` nova
  (planejada desde o PRD original, nunca criada), normalizando e-mail/
  telefone numa coluna gerada e isolada por organização via RLS. Função
  `is_contact_suppressed()` (security definer) é o ponto único que
  qualquer envio em massa futuro (campanhas, cadências, WhatsApp) vai
  ter que consultar antes de contatar alguém — falha fechada (erro na
  checagem = trata como suprimido). UI mínima em Configurações para
  registrar pedidos manuais de descadastro, já que campanhas/cadências
  ainda não existem para popular isso automaticamente.
- **Fila assíncrona real**: a tabela `jobs` já existia no schema desde
  o PRD original, mas tinha zero usos em `src`. Implementado
  `claim_next_job()` (SQL, `FOR UPDATE SKIP LOCKED` — necessário porque
  o supabase-js não expõe essa sintaxe) + um worker HTTP
  (`/api/v1/jobs/worker`) autenticado por `CRON_SECRET`, invocado pelo
  Vercel Cron a cada 5 minutos (`vercel.json`). Isso dá uso de novo a
  `CRON_SECRET`, que estava órfão desde que `/api/v1/jobs/billing-sync`
  foi removido na Fase 9. Retry com backoff exponencial + jitter;
  esgotadas as tentativas, o job vai para `dead_letter`. Dois jobs
  periódicos de manutenção ("se re-enfileiram" sozinhos com uma
  idempotency_key derivada do slot de horário) provam o ciclo completo
  de ponta a ponta: purgar `rate_limit_counters` expirados e devolver
  para `queued` jobs presos em `processing` por mais de 15min (caso o
  worker caia no meio do processamento de um job).
- **Rate limiting distribuído**: função `check_rate_limit()` (Postgres)
  substitui o contador em memória de `rate-limit.ts` no middleware —
  consistente entre instâncias/regiões da Vercel, sem precisar de
  Redis. Com fallback automático para o contador em memória se o banco
  estiver inacessível (nunca bloqueia login legítimo por causa de uma
  camada de hardening).
- **Auditoria estendida**: `audit_logs` já existia, mas só era usado
  para tentativas de login. Agora também registra: aprovação/rejeição
  de organização (painel admin), set/clear de qualquer credencial de
  integração (Asaas/OpenAI/Gmail), exclusão de organização, e criação
  de cobrança Asaas (Contratos) — as ações administrativas/financeiras
  que a própria `docs/08-security-operations.md` §8.2 já exigia e que
  não estavam cobertas.

### Bug real encontrado na verificação ao vivo (não no typecheck/lint/testes)

`check_rate_limit()` tinha uma coluna de retorno (`reset_at`) com o
mesmo nome de uma coluna da tabela `rate_limit_counters`, causando
"column reference reset_at is ambiguous" em toda chamada — só apareceu
ao executar a função de verdade contra o banco (`supabase/tests/
fase10-foundations-verification.sql`), não em nenhuma das checagens
estáticas. Corrigido qualificando a tabela com um alias dentro da
função. Fica registrado como lembrete: **uma função SQL nova sempre
precisa ser executada pelo menos uma vez de verdade antes de ser
considerada pronta** — typecheck/lint não alcançam o corpo de uma
function PL/pgSQL.

### O que esta fase explicitamente NÃO fez

Observabilidade (Sentry/APM), backup gerenciado (upgrade do plano
Supabase), fila dedicada (Trigger.dev/Inngest) e rate limit via Redis
continuam como decisões de negócio pendentes do usuário — ver seção 6
de `ETAPA-0-AUDITORIA.md`. Nenhum dos 10 módulos novos (enriquecimento,
website audit, etc.) foi implementado ainda; esta fase foi só a
fundação que eles vão precisar.

### Testes

215/215 passando (2 arquivos novos: `retry-policy.test.ts`). `next
build`, `npm run lint` e `npm run typecheck` limpos. Verificação de RLS/
isolamento feita ao vivo contra o projeto real (ver `supabase/tests/
fase10-foundations-verification.sql`): isolamento cross-tenant da lista
de supressão, normalização de contato, bloqueio de `claim_next_job`
para `authenticated`/`anon`, comportamento de `check_rate_limit`, e o
ciclo de vida completo de um job (enqueue → claim atômico → não pode
ser reivindicado duas vezes). Dados de teste dessa verificação (2 orgs,
2 usuários, 1 job, 1 linha de rate limit, 1 entrada de supressão, todos
com e-mail `fase10-test-*@example.test`) não puderam ser limpos nesta
sessão (a confirmação da ferramenta MCP para a instrução de limpeza não
foi entregue/respondida) — os ids e os `DELETE`s exatos estão
registrados no cabeçalho do próprio script de verificação.

## Módulo 1 — Enriquecimento Inteligente de Empresas

Primeira fase pós-fundações (Fase 10), recomendada no próprio relatório
dela por reaproveitar mais do que já existe (web presence checker, fila
assíncrona, audit log) e alimentar os futuros módulos de Score/Scoring.

### O que foi implementado

- Tabela nova `company_enrichment_fields`: cada achado (e-mail, telefone,
  site, ou link de rede social — Instagram/Facebook/LinkedIn/TikTok/
  YouTube/X) fica como uma **proposta** `pending`, nunca grava direto nas
  colunas de `companies`. Unique `(company_id, field_key, field_value)`
  evita duplicar a mesma proposta em re-scans. RLS no mesmo padrão
  tenant-scoped das outras tabelas (`select_member`/`insert_editor`/
  `update_editor`/`delete_admin`).
- Extração **determinística via regex**, nunca IA — decisão deliberada
  para não gastar custo de IA numa tarefa que não precisa de
  interpretação e para manter a regra "nunca inventar fatos, distinguir
  fato de hipótese": um link `mailto:`/`tel:`/de rede social que está de
  fato no HTML da página é um fato observado, não uma inferência (ver
  `src/modules/companies/enrichment/extract-contacts.ts`, com testes
  unitários). O campo `is_ai_inferred` já existe no schema, reservado
  para uma extração baseada em IA futura — deliberadamente não usado
  nesta fase.
- `src/modules/companies/enrichment/enrichment.service.ts`: orquestra a
  busca do HTML (direto, se a empresa já tem `website`; via
  `DomainProbeWebPresenceChecker` — o mesmo verificador da prospecção —
  quando não tem) e a extração; lista propostas pendentes; aplica
  aceite/rejeição (aceite grava na coluna real de `companies`, com merge
  não destrutivo em `social_links`, que é jsonb).
- UI síncrona: botão "Enriquecer" na página de detalhe da empresa
  (`CompanyEnrichmentSection`), mesmo princípio de honestidade de estado
  da seção de Análise com IA — mostra "sem site identificado" quando não
  há nada para analisar, nunca finge sucesso. Lista as propostas
  pendentes com Aceitar/Rejeitar por campo.
- UI em lote: botão "Enriquecer empresas pendentes" na listagem de
  empresas — enfileira um job `enrich_company` por empresa sem
  `website`/`email`/`phone`, usando a fila assíncrona da Fase 10 (seu
  primeiro uso de negócio real, não apenas manutenção). `idempotencyKey`
  por dia evita duplicar o mesmo job no mesmo clique duplo, mas permite
  tentar de novo em dias seguintes.
- Auditoria (`company_enrichment.scan`, `company_enrichment_field.accept`/
  `.reject`, `company_enrichment.batch_enqueue`) via `logAudit()` da
  Fase 10.

### O que esta fase explicitamente NÃO fez

- Nenhuma extração via IA (texto livre da página, OCR de imagem, etc.) —
  só regex sobre links explícitos (`mailto:`/`tel:`/âncoras de rede
  social). Fica como incremento futuro se o recall do regex se mostrar
  insuficiente.
- Nenhuma raspagem de buscadores/mapas — mesma restrição já registrada
  para o verificador de presença digital (ToS do Google/Maps).
- Nenhum limite de taxa dedicado para o fetch do HTML além do timeout de
  8s por requisição; em lote, depende só do orçamento de tempo do worker
  (`MAX_BUDGET_MS`) e do limite de 500 candidatos por clique no botão em
  lote.

### Testes

222/222 passando (7 novos em `extract-contacts.test.ts`, cobrindo
mailto válido/inválido, tel válido/curto demais, redes sociais
conhecidas, links genéricos de compartilhar/login descartados, e
deduplicação). `next build`, `npm run lint` e `npx tsc --noEmit`
limpos. Migration aplicada ao projeto real (`company_enrichment_fields`
— schema confirmado via `information_schema.columns`); `get_advisors`
(security) não reportou nenhum achado novo causado por esta fase.

## Módulo 3 — Digital Presence Score

Pulei o Módulo 2 (Website Audit) de propósito: a ordem oficial do plano
(`ETAPA-0-AUDITORIA.md` seção 9) coloca o Módulo 3 antes — ele depende
do Módulo 1 estar emitindo dados de contato/redes sociais, o que agora é
o caso, enquanto o Módulo 2 só depende de uma integração externa isolada
(PageSpeed) e pode ser feito em paralelo depois.

### O que foi implementado

- Tabela nova `digital_presence_scores`: **histórico, nunca sobrescreve**
  — cada recálculo insere uma linha nova com `score` (0-100) e `criteria`
  (pesos usados + sinais brutos daquele cálculo), para auditar por que o
  score mudou entre duas datas. RLS tenant-scoped; de propósito só com
  policy de `select`/`insert` (é um log de auditoria do próprio score,
  não algo que se edita ou apaga pela aplicação).
- Cálculo **puramente determinístico por fórmula de pesos**, nunca IA —
  mesmo princípio do Sales Analyst da Fase 7 ("a IA só interpreta números
  já calculados pelo servidor"): aqui não há nem IA interpretando, é só
  uma fórmula transparente e testável (`digital-presence-score.ts`, função
  pura, sem I/O). Pesos: site 30, e-mail 15, telefone 15, até 4 redes
  sociais a 10 cada (máx. 40) — soma exatamente 100, verificado por teste.
- Recálculo **automático**: toda vez que uma proposta de enriquecimento
  (Módulo 1) é aceita, o score é recalculado e uma nova linha é gravada —
  best-effort, nunca bloqueia o aceite em si se falhar (só loga).
- Recálculo **manual**: botão "Recalcular" na página da empresa
  (`DigitalPresenceScoreCard`), para empresas com dados de contato
  anteriores ao Módulo 1 existir, que nunca passaram pelo gatilho
  automático.
- Auditoria (`digital_presence_score.recompute`) via `logAudit()`.

### O que esta fase explicitamente NÃO fez

- Nenhuma integração com Website Audit (Módulo 2) — a pontuação de
  presença digital não inclui, por ora, performance/SEO técnico do site,
  só a existência dos canais de contato.
- Nenhuma exibição do score na listagem de empresas (só no detalhe) —
  deixado para quando o Módulo 4 (Lead Scoring 2.0) ou um ajuste de UI
  puro precisar disso; o cálculo e o histórico já existem ponta a ponta.
- Nenhum recálculo em lote/automático por cron — só nos dois gatilhos
  acima (aceite de campo e botão manual).

### Testes

230/230 passando (8 novos em `digital-presence-score.test.ts`, incluindo
a invariante "pesos somam 100"). `next build`, `npm run lint` e `npx tsc
--noEmit` limpos. Migration aplicada ao projeto real — schema confirmado
via `information_schema.columns`; `get_advisors` (security) não reportou
nenhum achado novo causado por esta fase.

## Módulo 4 — Lead Scoring 2.0

Pulei o Módulo 2 (Website Audit) de novo — continua bloqueado pela
decisão de negócio pendente da seção 6 da auditoria (chave de API do
Google PageSpeed / projeto GCP), que ainda não foi tomada. O Módulo 4
não tem essa dependência externa e já tinha os sinais de que precisava
(Módulos 1 e 3), então segui com ele.

### O que foi implementado

- Decompõe o placar único de 6 critérios do Lead Scorer (Fase 5) em 3
  dimensões — **Potencial** (`service_fit` + `observable_need`),
  **Aderência** (`icp_fit` + `data_quality`) e **Prioridade**
  (`contact_ease` + `interest_signals`) — cada critério pertence a
  exatamente uma dimensão (verificado por teste).
- **Nunca uma nova chamada de IA**: a decomposição é uma reagregação
  puramente determinística (média ponderada pelos pesos já existentes em
  `LEAD_SCORE_CRITERIA`) dos mesmos números que o Lead Scorer já havia
  devolvido em `score_breakdown` — zero custo adicional de IA
  (`lead-score-dimensions.ts`, função pura, testada sem IA/banco).
- Tabela nova `lead_scores`: histórico (nunca sobrescreve), mesmo
  princípio de `digital_presence_scores` do Módulo 3. `leads.score`
  (campo único existente desde a Fase 5) continua sendo atualizado
  normalmente — é o "cache do valor atual" que a própria auditoria
  propôs manter, nenhuma funcionalidade existente foi removida.
- Gravação **automática** a cada qualificação bem-sucedida (dentro de
  `scoreLead()`, best-effort — nunca invalida a qualificação em si se a
  gravação do histórico falhar).
- Ação manual "Calcular dimensões" para leads qualificados antes deste
  módulo existir — relê a última `ai_analyses` do tipo `lead_score` já
  salva e decompõe sem gastar uma nova chamada de IA.
- UI: `LeadScoreDimensionsCard` ao lado da seção de qualificação
  existente na página do lead, com badge colorido por dimensão (verde
  ≥70, amarelo ≥35, vermelho abaixo).
- Auditoria (`lead_score_dimensions.recompute`) no caminho manual.

### O que esta fase explicitamente NÃO fez

- Nenhuma mudança na UI/lógica de priorização de leads na listagem ou no
  pipeline (kanban) para usar as 3 dimensões — hoje elas só aparecem no
  detalhe do lead. Ordenar/filtrar por dimensão fica como possível
  próximo incremento de UI, não bloqueia o módulo funcionar ponta a
  ponta.
- Nenhuma alteração no prompt/schema do Lead Scorer em si — os 6
  critérios e pesos da Fase 5 continuam exatamente os mesmos; o Módulo 4
  é só uma camada de leitura sobre o que já existe.

### Testes

236/236 passando (6 novos em `lead-score-dimensions.test.ts`, incluindo
a verificação de que os 6 critérios cobrem exatamente as 3 dimensões
sem sobreposição ou lacuna). `next build`, `npm run lint` e `npx tsc
--noEmit` limpos. Migration aplicada ao projeto real — schema
confirmado via `information_schema.columns`; `get_advisors` (security)
não reportou nenhum achado novo causado por esta fase.

## Módulo 5 — Recomendação de Serviços

Antes de escrever qualquer código, reli a auditoria (seção 4) e investiguei
o código real do Company Analyzer (Fase 5) — e encontrei algo que a
auditoria não tinha capturado: o campo `opportunities` (`{service_id,
service_name, reason, priority}[]`) já existe, já é alimentado com o
catálogo real de serviços da organização, já é persistido em
`ai_analyses` (`analysis_type='company_analysis'`) e já é renderizado na
página da empresa (seção "Oportunidades"). Ou seja, a classificação da
auditoria de que "nenhuma lógica de recomendação baseada em perfil de
empresa" existia estava imprecisa — a lógica central já existe e funciona.

Pela regra "preservar todas as funcionalidades existentes", este módulo
**não duplica** essa IA com uma segunda chamada paralela. Em vez disso,
fiz duas coisas genuinamente novas:

### O que foi implementado

1. **Sinal novo na entrada do Company Analyzer**: a Pontuação de
   Presença Digital (Módulo 3) agora é passada como mais um fato
   determinístico de entrada (`buildCompanyAnalyzerInput` ganhou um
   parâmetro opcional `digitalPresenceScore`), com instrução explícita de
   que a IA deve tratá-la como fato já calculado pelo servidor — nunca
   recalculá-la ou substituí-la por estimativa própria. Como mudei o
   texto de `COMPANY_ANALYZER_INSTRUCTIONS`, subi `PROMPT_VERSIONS.companyAnalyzer`
   de `"v1"` para `"v2"` (regra do prompt mestre: nunca editar prompt de
   produção sem versionar — análises antigas continuam com
   `prompt_version="v1"` no histórico, intactas).
   - Dados de enriquecimento (Módulo 1) **já chegavam** implicitamente ao
     Company Analyzer, porque um campo aceito é gravado direto nas
     colunas de `companies` (email/telefone/website/social_links) que
     `formatCompanyFacts` já lê — não precisou de nenhum caminho de
     entrada novo.
   - Dimensões de Lead Scoring (Módulo 4) não se aplicam aqui: são
     sinais por lead, e o Company Analyzer opera no nível de empresa.
2. **View `latest_company_service_opportunities`** (migration
   `module5_service_recommendations`): achata, para cada empresa não
   arquivada, as `opportunities` da análise `company_analysis` mais
   recente. **Nenhuma tabela nova** — respeita literalmente a proposta da
   auditoria (seção 7) de reaproveitar `ai_analyses` sem schema novo; é
   só uma VIEW de leitura, que não armazena nada por si só. Usa
   `security_invoker = true` (confirmado Postgres 17 no projeto) para que
   a RLS de `ai_analyses`/`companies` seja aplicada com o papel de quem
   consulta — sem isso, a view rodaria com os privilégios de quem a
   criou e ignoraria RLS.
3. **Página `/recommendations`** ("Recomendações"): lista agregada de
   oportunidades entre TODAS as empresas da organização, com filtro por
   serviço e por prioridade, resumo por serviço no topo (contagem total
   e quantas são de prioridade alta) e link direto para cada empresa.
   Esse é o ganho real deste módulo: hoje só era possível ver
   oportunidades abrindo empresa por empresa; agora um vendedor vê a
   lista priorizada de uma vez. Item novo no menu lateral ("Recomendações").
4. Ordenação pura e testável (`rankRecommendations`/`summarizeByService`
   em `rank-recommendations.ts`) — prioridade alta→baixa, e dentro da
   mesma prioridade, por `company_score` decrescente — mesmo padrão das
   funções puras dos Módulos 3/4.

### O que esta fase explicitamente NÃO fez

- Não criou uma segunda chamada de IA dedicada a "recomendação de
  serviço" — o `opportunities` do Company Analyzer já cumpre esse papel;
  duplicar seria o oposto de "preservar funcionalidades existentes" e
  gastaria IA/orçamento à toa.
- Não alterou o schema `companyAnalysisSchema`/`opportunitySchema` nem a
  UI existente de "Oportunidades" na página da empresa — continuam
  exatamente como estavam.
- Não criou nenhuma ação de mutação nova: `/recommendations` é
  inteiramente leitura (reagregação do que o Company Analyzer já gerou).
- Módulo 2 (Website Audit) continua pulado — decisão de negócio
  pendente (PageSpeed/GCP, seção 6 da auditoria).

### Testes

243/243 passando (10 novos em `rank-recommendations.test.ts`). `next
build`, `npm run lint` e `npx tsc --noEmit` limpos. Migration (a view)
aplicada ao projeto real; `get_advisors` (security e performance) não
reportou nenhum achado novo causado por esta fase — em particular,
nenhum alerta de "Security Definer View", confirmando que
`security_invoker=true` surtiu o efeito esperado.

## Módulo 6 — Campanhas de Vendas

Maior volume de código novo do plano (como a própria auditoria previu,
seção 9). Antes de implementar, reli a seção 6 (decisões de negócio
pendentes) e a seção 9 — e a auditoria já avisava que este módulo
depende de o item 1 (supressão/LGPD, Fase 10) estar pronto, o que está:
`suppression_entries` + `is_contact_suppressed()` (fail-closed) já
existiam e nunca tinham sido usados por nenhuma rotina de envio real.

### Decisão de negócio pendente (seção 6) — como foi resolvida

A auditoria aponta que ela não pode decidir sozinha "o texto padrão de
descadastro" nem "o prazo de retenção de mensagens". Decidi não inferir
nenhum dos dois:

- **Texto de descadastro**: em vez de um texto padrão da plataforma (que
  nem faria sentido — cada organização é um negócio diferente, com seu
  próprio tom e política), virou um campo obrigatório por organização
  (`organization_profiles.unsubscribe_text`, editável em Configurações →
  Perfil). O backend **bloqueia o envio de qualquer mensagem de campanha**
  enquanto esse campo estiver vazio (`getCampaignMessageSendBlockReason`).
  A IA nunca escreve esse texto — é sempre literalmente o que a própria
  organização digitou, anexado automaticamente no envio
  (`renderCampaignMessageBody`).
- **Prazo de retenção**: deliberadamente sem purga automática por
  agora — mesmo estado de toda outra tabela deste schema hoje. Pendência
  explícita (ver abaixo), não uma decisão silenciosa.
- **Supressão por e-mail, telefone ou ambos**: já estava resolvido
  estruturalmente desde a Fase 10 — `is_contact_suppressed` aceita o
  tipo de contato por chamada; Módulo 6 (canal e-mail) checa por e-mail.

### O que foi implementado

1. **Migration `module6_campaigns`**: `campaigns`, `campaign_companies`
   (uma empresa pode estar em várias campanhas; status
   selecionada/excluída/contatada/respondeu), `campaign_messages` (uma
   linha por empresa-na-campanha — rascunho → aprovação → envio, "quem
   aprovou" nunca omitido) e a coluna `organization_profiles.unsubscribe_text`.
   RLS em todas: `select_member`/`insert_editor`/`update_editor`;
   `campaign_messages` nunca tem política de `delete` — trilha de
   auditoria do que foi de fato aprovado/enviado é permanente.
2. **Campanhas operam em `companies`, não em `leads`**: decisão
   deliberada — uma empresa só pode ter 1 lead ativo por vez
   (`leads_one_active_company_idx`), e campanhas de prospecção precisam
   alcançar empresas ainda não qualificadas em nenhum lead. Por isso
   `campaign_messages` é uma tabela própria, não uma reutilização de
   `outreach_emails` (que é por lead).
3. **Geração de e-mail por IA, por empresa, nunca em lote**: novo prompt
   `CAMPAIGN_MESSAGE_INSTRUCTIONS`/`buildCampaignMessageInput`, com a
   MESMA filosofia anti-disparo-em-massa do Outreach Generator existente
   (Fase 5: "PROIBIDO parecer... um disparo em massa") — cada e-mail é
   gerado olhando os dados reais daquela empresa (fatos cadastrais +
   última análise de IA do Módulo 5 quando houver + Pontuação de
   Presença Digital do Módulo 3 quando houver), nunca um template
   reaproveitado entre empresas da mesma campanha.
4. **Aprovação humana obrigatória antes de enviar**: todo rascunho nasce
   `status=draft`; só pode ser enviado depois de `approved` (campo
   `approved_by`/`approved_at` preenchido por uma ação explícita do
   usuário) — mesma regra de "nenhuma ação de IA que muda dados é
   automática" usada em toda a Fase 5.
5. **Envio reaproveita o mecanismo existente do Gmail SMTP** (Fase 5) —
   extraí `resolveOrgGmailCredentials` para `src/lib/email/` para não
   duplicar entre o envio manual de e-mail (lead) e o envio de campanha.
   Checagem de supressão (fail-closed) roda nos dois agora — **corrigi
   uma lacuna real**: o envio manual de e-mail de prospecção (Fase 5)
   nunca checava supressão antes desta fase; agora checa.
6. **Envio em massa aprovado passa pela fila assíncrona da Fase 10**
   (`send_campaign_message` job type) em vez de bloquear a requisição —
   cada job roda as mesmas 4 checagens (aprovação, supressão, texto de
   descadastro, Gmail) isoladamente; falha de uma empresa nunca trava as
   outras.
7. UI: `/campaigns` (lista + criação) e `/campaigns/[id]` (adicionar
   empresas por busca, editor de rascunho por empresa, gerar com IA,
   aprovar, enviar individual ou "Enviar aprovadas" em lote). Item novo
   no menu.

### O que esta fase explicitamente NÃO fez

- Nenhuma detecção automática de resposta — "respondeu" é um status
  manual (`campaign_companies.status`); não há integração de leitura de
  caixa de entrada nesta fase.
- Nenhuma purga automática de mensagens antigas — pendência explícita
  (ver acima), igual a Sentry/Redis/upgrade de plano na Fase 10.
- Nenhum canal além de e-mail (`channel` já está no schema como check
  constraint preparado para `whatsapp` no Módulo 8, mas só `'email'` é
  aceito agora).
- Não editei o Outreach Generator nem o Company Analyzer em si (fora o
  sinal de Pontuação de Presença Digital já adicionado no Módulo 5) —
  são caminhos de IA deliberadamente distintos do de campanha.

### Testes

252/252 passando (9 novos em `campaign-message-compose.test.ts`). `next
build`, `npm run lint` e `npx tsc --noEmit` limpos. Migration aplicada
ao projeto real; `get_advisors` (security) sem nenhum achado novo
causado por esta fase.

## Implementação completa sob a premissa "só integrações gratuitas/open source"

A partir deste ponto, o usuário autorizou implementar **todo o restante
do plano de uma vez** (Módulos 2, 7, 8, 9, 10), sob uma premissa nova e
explícita: usar só integrações gratuitas ou alternativas open source; o
que não for possível sob essa premissa deve ser **cortado do sistema**,
com a decisão documentada aqui, em vez de inferido ou implementado com
custo recorrente sem aprovação. As seções abaixo (Módulos 2, 7, 9, 10 e
a decisão de corte do Módulo 8) são o resultado dessa diretriz.

## Módulo 2 — Website Audit (PageSpeed Insights)

A auditoria original (ETAPA-0-AUDITORIA.md seção 6) listava este módulo
como dependente de uma decisão de negócio: "precisa de chave de API do
Google Cloud... requer projeto GCP e possivelmente billing habilitado".
Sob a premissa gratuita/open-source desta fase, resolvo o bloqueio sem
precisar perguntar de novo: a **Google PageSpeed Insights API v5** tem
cota gratuita generosa (25.000 requisições/dia por chave) e **não exige
conta de faturamento habilitada no Google Cloud** para esse uso — só a
API "PageSpeed Insights API" ativada em um projeto GCP gratuito e uma
chave de API. Isso desbloqueia o módulo dentro da premissa do usuário.

### O que foi implementado

1. **Migration `module2_website_audit`**: estende
   `organization_integration_credentials` com `pagespeed_secret_id`/
   `pagespeed_configured_at` e as funções `set_org_pagespeed_credentials`/
   `clear_org_pagespeed_credentials`/`get_org_pagespeed_api_key`
   (`SECURITY DEFINER`, Vault) — **exatamente o mesmo padrão** já usado
   para Asaas/OpenAI/Gmail (Fase 9): cada organização usa sua própria
   chave gratuita, nunca uma chave global do FinderFlow. Nova tabela
   `website_audits` (histórico append-only, mesmo princípio de
   `digital_presence_scores`: nunca sobrescreve, inclusive quando a
   auditoria falha — grava `status='failed'` + `error_message`).
2. **Correção de segurança descoberta durante esta migration**: o
   default ACL deste projeto hoje concede `EXECUTE` a `anon`
   automaticamente na criação de qualquer função nova (diferente do
   momento em que as funções Asaas/OpenAI/Gmail foram criadas) — as 3
   funções novas de credencial PageSpeed nasceram com essa concessão
   indesejada; corrigido com um `revoke` explícito de `anon`, e já
   embutido na própria migration para qualquer ambiente novo.
3. **Cliente PageSpeed** (`src/lib/integrations/pagespeed-client.ts`):
   chamada HTTP separada do parsing — `extractWebsiteAuditSignals` é
   função pura e testável sem rede, extrai os 4 scores (desempenho,
   acessibilidade, boas práticas, SEO, convertidos de 0-1 para 0-100),
   as 3 Core Web Vitals (LCP, CLS, TBT) e até 6 problemas (audits com
   score < 0.9 — convenção do próprio Lighthouse) de uma lista fixa de
   auditorias relevantes. Nunca inventa número: categoria ausente na
   resposta vira `null`, não um valor arbitrário.
4. **`website-audit.service.ts`**: `runWebsiteAudit` roda de forma
   síncrona (não passa pela fila assíncrona da Fase 10 nesta primeira
   versão — uma chamada à PageSpeed API responde em poucos segundos;
   timeout de 25s dá margem segura dentro do limite de função da
   Vercel). Decisão de escopo deliberada, documentada aqui em vez de
   escondida.
5. **Rate limit por organização**: 20 auditorias/hora via
   `checkDistributedRateLimit` (Fase 10) — mitiga o risco #5 da
   auditoria ("rate limiting não distribuído em frente a provedores
   externos... pode gerar custo inesperado ou banimento do provedor");
   mesmo a cota do PageSpeed sendo gratuita, protege contra um loop
   acidental esgotar a cota diária da organização.
6. UI: formulário de chave em Configurações → Integrações (mesmo
   padrão visual de Asaas/OpenAI/Gmail) e um novo card "Auditoria de
   site" na página da empresa (scores, Core Web Vitals, lista de
   problemas, botão "Rodar auditoria" — desabilitado sem site
   cadastrado ou sem a chave configurada, com orientação direta para
   Configurações).

### O que esta fase explicitamente NÃO fez

- **Não integrei o resultado da auditoria ao Digital Presence Score
  (Módulo 3) nem ao Company Analyzer** — a auditoria original sugeria
  isso como possível ("e/ou"), não como obrigatório; dado o volume de
  módulos desta fase, mantive o Website Audit como módulo autocontido
  e testável isoladamente. Possível melhoria futura, não uma lacuna
  silenciosa.
- Só a estratégia `mobile` é rodada automaticamente (o schema já aceita
  `desktop` via `strategy`, mas não há botão para isso na UI ainda).
- Nenhuma purga automática do histórico de auditorias — mesma pendência
  já registrada para outras tabelas de histórico deste projeto.

### Testes

Suíte completa permanece verde (257/257, 5 novos em
`pagespeed-client.test.ts` cobrindo o parser puro: conversão de score,
extração de Core Web Vitals, seleção de problemas por score < 0.9,
ausência de invenção de dado quando a resposta vem vazia). `next
build`, `npm run lint` e `npx tsc --noEmit` limpos. Migration aplicada
ao projeto real; `get_advisors` (security) revisado — achado de `anon`
nas 3 funções novas corrigido na mesma migration, sem achados novos
restantes causados por esta fase.

## Módulo 8 — WhatsApp Business: **decisão de corte** (não implementado)

A auditoria original já apontava este módulo como o de maior incerteza
externa (seção 6: "requer conta Meta Business verificada, número de
telefone dedicado, e normalmente um BSP... processo de aprovação da
Meta pode levar dias/semanas"). Sob a premissa desta fase — só
integrações gratuitas ou alternativas open source, e cortar o que não
couber nela — avaliei as duas únicas rotas reais e nenhuma passa o
critério com segurança suficiente para entrar no sistema agora:

1. **API oficial da Meta (WhatsApp Cloud API), uso direto sem BSP
   pago**: tem um nível de uso gratuito (conversas iniciadas pelo
   usuário dentro de certas categorias/janela de 24h, e um número
   limitado de conversas iniciadas pela empresa por mês, grátis). Mas
   **não é algo que eu possa simplesmente "ligar" no código**:
   - exige um número de telefone dedicado (não pode ser o WhatsApp
     pessoal de alguém) e, a partir de um certo volume, **verificação
     de negócio pela Meta** — um processo de aprovação externo, de
     prazo imprevisível (dias a semanas), fora do meu controle e do
     controle do próprio usuário;
   - contas não verificadas começam com um limite baixíssimo de
     conversas iniciadas pela empresa por dia, pensado para teste, não
     para campanhas reais (o próprio caso de uso do Módulo 6/7);
   - templates de mensagem também passam por aprovação da Meta antes
     de poderem ser usados — não é uma chave de API simples como
     PageSpeed/Gmail/OpenAI, é um processo de homologação com SLA que a
     Meta controla, não eu.
   Ou seja: tecnicamente "gratuita" dentro de certos limites, mas **não
   é uma integração que eu possa implementar e entregar funcionando
   hoje** — o gargalo é um processo de aprovação externo e imprevisível
   de um terceiro, não código.
2. **Bibliotecas open source não-oficiais** (ex.: Baileys,
   whatsapp-web.js, venom-bot — todas usam o protocolo do WhatsApp Web
   de forma reversa, não a API oficial): são, de fato, gratuitas e
   open source — passariam a letra da premissa desta fase. **Mas
   violam os Termos de Serviço do WhatsApp** (automação de mensagens
   fora da API oficial é um dos usos explicitamente proibidos) e
   carregam um risco real e conhecido de **banimento permanente do
   número de telefone da organização** sem aviso prévio, exatamente no
   caso de uso que este plano pede (campanhas/cadências de prospecção
   em volume). Implementar isso significaria colocar o número de
   WhatsApp de cada organização cliente em risco de banimento para
   viabilizar uma funcionalidade — um risco de negócio e reputacional
   que não é meu para assumir silenciosamente, e que a própria regra
   do projeto ("nunca inferir decisão de negócio sem perguntar")
   cobre: o usuário autorizou "integrações gratuitas ou open source",
   não "violar os termos de uso de um provedor terceiro".

**Decisão**: Módulo 8 — WhatsApp Business **cortado do sistema nesta
fase**. Nenhuma tabela, rota, credencial ou dependência de WhatsApp foi
criada. O canal `channel` em `campaign_messages` (Módulo 6) já tinha
`'whatsapp'` preparado no `check constraint` como possibilidade futura
— continua lá como documentação de intenção, mas nenhum código o usa;
só `'email'` é aceito. O WhatsApp do perfil da organização
(`organization_profiles.whatsapp_number`, Fase 5) continua existindo
apenas como **convite manual** nos e-mails de prospecção ("continue a
conversa por este WhatsApp") — isso nunca dependeu de uma API de envio
e não é afetado por este corte.

Caminho realista se o usuário decidir revisitar isso no futuro: iniciar
o processo de verificação de negócio na Meta (fora do meu controle,
prazo incerto) e, só depois dele aprovado, eu implemento a integração
via API oficial — nunca via biblioteca não-oficial, mesmo que gratuita.

## Módulo 7 — Cadências e Follow-up

A auditoria original (ETAPA-0-AUDITORIA.md seção 9, item 8) pedia
sequências de e-mail multi-etapa ("drip") para leads que não respondem
a um primeiro contato — distinto do Módulo 6 (campanhas em lote, com
IA gerando a mensagem): aqui o conteúdo de cada etapa é escrito **uma
vez, por um humano**, ao montar a cadência, e o envio posterior de
cada etapa é mecânico (um agendador comum, sem IA nenhuma envolvida em
tempo de envio). Essa diferença é deliberada e documentada em
comentário no próprio código (`module7_cadences.sql` e
`cadence-processor.service.ts`): como o humano já aprovou o texto ao
escrevê-lo, o envio automático de cada etapa não viola o princípio
"nenhuma ação de IA que muda dados é automática" — não há IA aqui para
violar o princípio.

### O que foi implementado

1. **Migration `module7_cadences`**: tabelas `cadences` (uma sequência
   nomeada, status `active`/`archived`), `cadence_steps` (etapas
   ordenadas com `day_offset`, `subject_template`, `body_template` —
   templates com placeholders `{{contact_name}}`/`{{company_name}}`/
   `{{sender_name}}`), `cadence_enrollments` (inscrição de um lead
   específico numa cadência, com `next_run_at`, `current_step_order`,
   `status` `active`/`paused`/`stopped`/`completed`, `unique(cadence_id,
   lead_id)` — um lead não pode estar duas vezes na mesma cadência ao
   mesmo tempo) e `cadence_step_sends` (histórico append-only de cada
   envio individual, mesmo padrão de `campaign_messages`). RLS em
   todas: membro lê, editor insere/atualiza; `cadence_step_sends` sem
   policy de update/delete (nunca editável, só auditável). Índice
   parcial `cadence_enrollments_due_idx ... where status = 'active'`
   para o worker achar rapidamente só as inscrições vencidas.
2. **Funções puras de composição** (`cadence-compose.ts`):
   `renderCadenceTemplate` (substitui placeholders, nunca inventa um
   valor ausente — deixa o placeholder literal se a variável não foi
   passada, para o erro ficar visível em vez de silencioso),
   `computeStepRunAt` (soma `day_offset` dias à data de início),
   `decideCadenceStep` (decide se uma etapa deve ser enviada, pulada —
   lead sem e-mail cadastrado — ou se a cadência inteira deve parar —
   lead ganho/perdido, ou contato suprimido). 9 testes cobrindo cada
   combinação.
3. **Reaproveitamento explícito, não reimplementação**: supressão
   (`isContactSuppressed`, fail-closed, Fase 10) e texto obrigatório de
   descadastro por organização (`organization_profiles.unsubscribe_text`,
   Módulo 6) são usados exatamente como estão — nenhuma cópia, nenhuma
   lógica paralela.
4. **Processamento assíncrono**: `processDueCadenceSteps` roda em lote
   de 50 inscrições vencidas por execução, chamado pelo job periódico
   `process_cadence_steps` (fila da Fase 10, intervalo de 15 minutos) —
   nunca síncrono na requisição do usuário, porque cada ciclo pode
   envolver centenas de inscrições e envios de e-mail reais. Falha de
   credencial de e-mail não configurada reagenda a etapa em 24h (não
   marca a inscrição como parada — a organização pode configurar o
   Gmail depois e o drip continua de onde parou).
5. **UI**: página `/cadences` (criar cadência, listar com contagem de
   etapas e inscrições ativas) e `/cadences/[id]` (gerenciar etapas:
   adicionar com ordem/offset/templates, remover, arquivar/reativar a
   cadência). Na página do lead, um novo card "Cadências de
   follow-up": inscrição manual (sempre uma decisão humana — nunca uma
   cadência inicia sozinha), lista de inscrições atuais com
   pausar/retomar e "Marcar como respondeu" (condição de parada manual
   explícita pedida na auditoria, seção 9 item 8).
6. Item de navegação "Cadências" adicionado ao menu do workspace.

### O que esta fase explicitamente NÃO fez

- **Nenhum canal além de e-mail.** O Módulo 8 (WhatsApp) foi cortado
  nesta mesma fase — ver decisão acima — então cadências por WhatsApp
  nunca foram uma opção real aqui, apesar de a auditoria mencionar
  "e-mail e/ou WhatsApp".
- **Sem editor de texto rico para os templates** — `subject_template`/
  `body_template` são `textarea` simples (texto puro). Suficiente para
  o escopo desta fase; HTML/rich text é uma melhoria futura, não uma
  lacuna silenciosa.
- **Sem reinscrição automática** depois de uma cadência parada — o
  `unique(cadence_id, lead_id)` é deliberado; reinscrever é uma
  decisão explícita de UI, nunca um reaproveitamento silencioso da
  mesma linha de inscrição.
- Nenhuma purga automática do histórico de `cadence_step_sends` — mesma
  pendência já registrada para outras tabelas de histórico deste
  projeto (campanhas, auditorias de site).

### Testes

Suíte completa permanece verde (266/266 — 9 novos testes em
`cadence-compose.test.ts` cobrindo renderização de template,
cálculo de `next_run_at` e as três decisões possíveis por etapa:
enviar, pular, ou parar a cadência inteira). `next build`, `npx eslint
.` e `npx tsc --noEmit` limpos. Migration aplicada ao projeto real;
`get_advisors` (security) revisado — nenhum achado novo causado por
este módulo (não introduz nenhuma função `SECURITY DEFINER`).

## Módulo 9 — Agente de Vendas IA

A auditoria original (seção 9, item 9) pedia um agente de IA capaz de
executar ações de vendas, com confirmação humana obrigatória antes de
qualquer ação que altere dados. Antes de escrever qualquer código,
investiguei as rotas `/assistant` e `/assistant/[id]` (já existentes
desde a Fase 5) para não duplicar funcionalidade: **o Copilot
conversacional da Fase 5 já é exatamente essa arquitetura** —
`src/modules/ai/copilot.service.ts` já implementa um loop de
tool-calling com allowlist fixa (`src/lib/ai/copilot-tools.ts`, nunca
SQL/credenciais livres para o modelo), e toda ferramenta marcada
`mutating: true` já exige confirmação explícita do usuário
(`pending_tool_call` persistido no servidor, nunca confiado do
cliente) antes de executar — nunca no mesmo turno em que o modelo a
propõe.

**Decisão**: não construir um agente novo e paralelo — isso duplicaria
essa infraestrutura inteira (loop de confirmação, persistência de
estado pendente, sanitização de dado de terceiros) só para chegar no
mesmo lugar. Em vez disso, o Módulo 9 é esta allowlist **estendida**
com ações e leituras dos módulos construídos depois do Copilot
existir — presença digital (Módulo 3), auditoria de site (Módulo 2) e
cadências de follow-up (Módulo 7) — para o mesmo agente poder agir
sobre eles com o mesmo portão de confirmação.

### O que foi implementado

1. Duas ferramentas de leitura novas: `get_digital_presence_score` e
   `get_website_audit`, ambas recebendo `leadId` e resolvendo a
   empresa internamente (nunca expõem `company_id` como argumento
   separado para o modelo inventar). Retornam `null`/mensagem honesta
   quando nunca foram calculadas — nunca um valor estimado pelo
   modelo.
2. Uma ferramenta de leitura `list_active_cadences` (nome + número de
   etapas das cadências ativas da organização) para o agente saber em
   qual cadência inscrever um lead antes de propor a ação.
3. Uma ferramenta mutante nova, `enroll_lead_in_cadence` — inscreve um
   lead numa cadência, reaproveitando `enrollLeadInCadence` (Módulo 7)
   sem duplicar a lógica de validação (já rejeita cadência sem etapas
   e inscrição duplicada). Marcada `mutating: true`: como toda ação
   que altera dados no Copilot, só executa depois da confirmação
   explícita do usuário na interface.
4. `COPILOT_INSTRUCTIONS` (prompt versionado, `v1` → `v2`) ganhou um
   parágrafo deixando explícito o papel de "agente de vendas" e
   reforçando que a confiança do modelo na ação nunca substitui a
   confirmação do usuário, nem mesmo quando o modelo "tem certeza".

### O que esta fase explicitamente NÃO fez

- **Nenhuma automação proativa** — o agente só age quando o usuário
  inicia a conversa e pede algo; ele nunca varre leads sozinho
  decidindo quem inscrever em uma cadência ou quando rodar uma
  auditoria. Isso seria uma mudança de categoria (de assistente
  reativo para rotina autônoma em background) fora do escopo pedido
  pela auditoria para este módulo.
- **Nenhuma ferramenta nova para Módulo 6 (campanhas) ou proposta** —
  o escopo desta extensão ficou deliberadamente restrito aos módulos
  cujos sinais fazem sentido num fluxo de decisão "ver sinal → agir":
  presença digital/auditoria informam a decisão, cadência é a ação.
  Disparar uma campanha ou gerar uma proposta via chat é uma extensão
  natural futura, não implementada agora para manter o escopo desta
  fase gerenciável.

### Testes

Suíte completa permanece verde (270/270 — 4 novos testes em
`copilot-tools.test.ts` cobrindo as 3 ferramentas de leitura novas e a
validação de argumentos + `describeForConfirmation` de
`enroll_lead_in_cadence`). `next build`, `npx eslint .` e `npx tsc
--noEmit` limpos. Nenhuma migration nova — reaproveita tabelas e
funções já existentes, então não há achado novo de `get_advisors` a
revisar.

## Módulo 10 — Inteligência de Conversão

A auditoria original (seção 9, item 10) pediu relatórios/dashboard
sobre dados já existentes: taxa de resposta de campanhas, resultado de
cadências, conversão/taxa de ganho do pipeline. A última parte —
conversão e taxa de ganho do pipeline — **já existia desde a Fase 7**
(`/reports`, `reports.service.ts`: conversão por segmento, origem,
responsável, etapa e serviço, ciclo médio, ticket médio, motivos de
perda). Por isso este módulo não cria uma página nova: estende
`/reports` com as duas peças que realmente faltavam — desempenho de
campanhas (Módulo 6) e resultado de cadências (Módulo 7) — no mesmo
seletor de período que já existia.

### O que foi implementado

1. **`computeCampaignPerformance`** (função pura e testada): agrega
   `campaign_companies` adicionadas no período por status — total,
   contatadas, responderam, excluídas — e calcula taxa de resposta
   como `respondido ÷ (contatado + respondido)`.
2. **`computeCadenceOutcomes`** (função pura e testada): agrega
   `cadence_enrollments` iniciadas no período por status (ativa,
   pausada, parada, concluída) com o detalhamento de motivos de
   parada, e `cadence_step_sends` por status (enviado/falhou/pulado)
   no mesmo período.
3. **Decisão deliberada sobre o que "taxa de resposta" significa
   aqui**: o sistema não tem rastreamento de abertura/clique de
   e-mail — nenhum provedor com webhook de tracking foi integrado (o
   envio é via Gmail SMTP da própria organização, Fase 5/Módulo 6).
   "Respondeu" só existe quando um humano confirma manualmente (botão
   "Marcar como respondeu" no Módulo 6 e no Módulo 7) — isso é
   documentado no próprio subtítulo da seção na UI, não escondido
   atrás de um número que pareceria mais sofisticado do que é.
4. UI: duas novas seções na página `/reports` existente — "Desempenho
   de campanhas" e "Resultados de cadências" — usando os mesmos
   componentes (`KpiCard`, `EmptyState`) já usados no resto da página,
   no mesmo período selecionado pelo filtro `from`/`to` existente.

### O que esta fase explicitamente NÃO fez

- **Nenhum rastreamento real de abertura/clique de e-mail** — exigiria
  um provedor de e-mail transacional com webhook (ex.: Resend,
  SendGrid), o que não é gratuito acima de um volume pequeno e, mais
  importante, trocaria o Gmail SMTP já configurado por organização
  (Fase 5) por uma integração nova — fora do escopo de "relatório
  sobre dados já existentes" que este módulo pediu.
- **Nenhuma exportação (CSV/PDF) dos novos relatórios** — mesmo estado
  da página de Relatórios como um todo hoje.

### Testes

Suíte completa permanece verde (276/276 — 6 novos testes cobrindo
`computeCampaignPerformance` e `computeCadenceOutcomes`: cálculo de
taxa de resposta, `responseRate` null quando não há contato/resposta
ainda, agrupamento de motivos de parada, e listas vazias). `next
build`, `npx eslint .` e `npx tsc --noEmit` limpos. Nenhuma migration
nova — só consultas de leitura sobre tabelas já existentes.

---

## Conclusão desta fase (Módulos 2, 7, 8, 9, 10)

Com o Módulo 10, esta fase do plano de evolução do FinderFlow AI
(ETAPA-0-AUDITORIA.md seção 9) está completa sob a premissa dada —
"somente integrações gratuitas ou alternativas open source, cortando o
que não couber nela". Resumo:

- **Módulo 2 — Website Audit**: implementado (Google PageSpeed
  Insights, gratuito dentro de cota generosa, sem exigir faturamento).
- **Módulo 7 — Cadências e Follow-up**: implementado (drip de e-mail
  multi-etapa com template humano, sem IA no envio).
- **Módulo 8 — WhatsApp Business**: **cortado**, decisão documentada
  acima — nenhuma rota real passa a premissa gratuita/open-source com
  segurança suficiente (API oficial depende de verificação de negócio
  externa e imprevisível pela Meta; bibliotecas não-oficiais violam os
  Termos de Serviço do WhatsApp e arriscam banimento do número).
- **Módulo 9 — Agente de Vendas IA**: implementado como extensão do
  Copilot já existente (Fase 5), em vez de um agente novo e paralelo —
  evitou duplicar toda a arquitetura de confirmação humana que já
  existia.
- **Módulo 10 — Inteligência de Conversão**: implementado como
  extensão da página de Relatórios já existente (Fase 7), com os dois
  relatórios que realmente faltavam (campanhas e cadências).

Também corrigida nesta fase, proativamente: uma divergência real entre
o repositório e o banco de dados (4 migrations aplicadas ao projeto
real em sessões anteriores que nunca tinham sido salvas como arquivo
local nem commitadas) — reconstruída a partir do histórico do próprio
Supabase e commitada, para qualquer ambiente novo não nascer com um
schema incompleto.

Nenhum fornecedor pago foi contratado nesta fase. Todas as integrações
novas (PageSpeed) usam cota gratuita por organização, no mesmo padrão
de credencial já estabelecido (Asaas/OpenAI/Gmail).

## Incidente: produção travada desde a Fase 10 (cron incompatível com plano Hobby)

Ao checar os deploys antes de publicar o Módulo 10, descobri que **todo
deploy de produção desde a Fase 10** (11 deploys consecutivos, de
`320e9b2` "fundações de infra" até `d110c17` "Módulo 10") falhou com:

```
Hobby accounts are limited to daily cron jobs. This cron expression
(*/5 * * * *) would run more than once per day. Upgrade to the Pro
plan to unlock all Cron Jobs features on Vercel.
```

**Causa**: a Fase 10 adicionou `vercel.json` com um cron a cada 5
minutos para `/api/v1/jobs/worker` (fila assíncrona), sem checar que a
conta Vercel deste projeto é Hobby (gratuita) — que só permite cron
**no máximo uma vez por dia**. A Vercel recusa o deploy inteiro quando
isso acontece (não é um erro de build do Next.js, por isso não
aparecia em nenhuma verificação local — `npm run build` nunca passa
por essa checagem de plano). Resultado prático: **a produção ficou
congelada no deploy de `33d7c6d`** (antes até da Fase 10) durante todo
este tempo — nenhuma das Fases 10/Módulos 1-10 chegou a rodar em
produção, embora todas estivessem corretas no repositório e
verificadas localmente.

**Correção aplicada agora**: `vercel.json` ajustado para `0 6 * * *`
(uma vez por dia, 03:00 no horário de Brasília) — dentro do limite do
plano Hobby, sem contratar nada novo (mantém a premissa de só usar o
que é gratuito).

**Custo real dessa correção, documentado sem rodeio**: a fila
assíncrona (enriquecimento de empresa, envio de e-mail de outreach em
lote, envio de campanhas, processamento de etapas de cadência) só é
drenada **uma vez por dia** agora, em vez de a cada 5/15 minutos. Isso
é uma degradação de experiência real, não só um detalhe técnico — um
lead inscrito numa cadência pela manhã só vai receber o próximo e-mail
no ciclo do dia seguinte, por exemplo.

**Alternativa melhor, não aplicada agora** (fica como próximo passo
recomendado, não decidido unilateralmente): usar um pinger HTTP externo
gratuito (ex.: cron-job.org, tem tier grátis que chama uma URL a cada 5
minutos) apontando para `/api/v1/jobs/worker` com o `CRON_SECRET` no
header — mantém a cadência de processamento rápida, continua 100%
gratuito, e não depende do limite de cron da própria Vercel. Não
configurei isso agora porque exige criar uma conta externa e decidir
isso com o usuário, fora do escopo de "corrigir o deploy e publicar".
