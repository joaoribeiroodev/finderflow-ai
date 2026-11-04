# PROMPT MESTRE — CONSTRUÇÃO DO FINDERFLOW AI

> Copie este prompt e envie ao Claude Code/Claude com a pasta completa do pacote anexada ou aberta como contexto do repositório. A especificação em `docs/` e o protótipo em `prototype/` são a fonte de verdade do produto.

---

## PAPEL E MISSÃO

Atue como **arquiteto de software sênior, engenheiro full-stack, especialista em SaaS multi-tenant, PostgreSQL/Supabase, Next.js, segurança, integrações financeiras e aplicações com IA**.

Sua missão é construir o **FinderFlow AI**, uma plataforma SaaS de prospecção B2B, descoberta de empresas, CRM, inteligência comercial e automação assistida por IA.

Não entregue apenas telas estáticas ou um scaffold vazio. Construa uma aplicação funcional, testável, segura, documentada e preparada para evoluir. Trabalhe em incrementos pequenos, execute os testes e explique as decisões tomadas. Não tente gerar todo o sistema em uma única resposta sem validar a base.

## CONTEXTO DO PRODUTO

O FinderFlow AI permite que uma organização:

1. Pesquise empresas por segmento e localização usando fontes híbridas e autorizadas.
2. Importe empresas via CSV ou cadastre manualmente.
3. Analise empresas com OpenAI para identificar oportunidades comerciais possíveis.
4. Selecione empresas e as converta explicitamente em leads.
5. Gerencie leads em pipeline Kanban ou tabela.
6. Registre contatos, tarefas, reuniões, notas e histórico.
7. Gere rascunhos de abordagem e propostas com IA.
8. Acompanhe oportunidades, negócios e métricas.
9. Contrate um plano SaaS e pague sua assinatura pelo Asaas.

Público inicial: freelancers, desenvolvedores, agências digitais, consultorias e pequenas empresas de serviços B2B. O catálogo e os critérios comerciais precisam ser configuráveis para diferentes setores.

## DECISÕES NÃO NEGOCIÁVEIS

- Nome: **FinderFlow AI**.
- Modelo: SaaS multi-tenant por `organization_id`.
- Frontend: Next.js App Router + TypeScript strict.
- Backend gerenciado: Supabase (PostgreSQL, Auth, RLS, Storage, Edge Functions).
- UI: Tailwind CSS + shadcn/ui (ou componentes equivalentes acessíveis).
- IA: OpenAI API, priorizando **Responses API**, Structured Outputs e function/tool calling conforme documentação vigente.
- Pagamentos da assinatura do FinderFlow: Asaas API, com checkout hospedado e webhook.
- Aquisição: arquitetura híbrida com adaptadores de provedores, CSV e entrada manual.
- Arquitetura: monólito modular no MVP; não introduzir microserviços sem necessidade comprovada.
- Idioma da interface: português do Brasil.
- Moeda: BRL.
- Timezone padrão inicial: `America/Bahia`, permitindo configuração por organização.
- Design: dark mode premium, grafite/preto com roxo/violeta tecnológico, magenta/ciano usados como acentos de marketing e analytics. Referência: `assets/ui-reference-collage.png` e `prototype/index.html`.
- Empresa descoberta não é lead até o usuário confirmar a conversão.
- Asaas no MVP cobra somente a assinatura do FinderFlow, não as vendas que os assinantes fazem a seus próprios clientes.
- Mensagens geradas por IA são rascunhos. Não enviar comunicações externas automaticamente sem autorização explícita.

## DOCUMENTAÇÃO OBRIGATÓRIA A LER

Antes de codificar, leia integralmente:

- `README.md`
- `docs/01-product-requirements.md`
- `docs/02-architecture.md`
- `docs/03-database.md`
- `docs/04-api-contracts.md`
- `docs/05-integrations.md`
- `docs/06-design-system.md`
- `docs/07-backlog-and-acceptance.md`
- `docs/08-security-operations.md`
- `database/001_core_schema.sql`
- `prototype/index.html`

Se houver conflito, registre a divergência em `docs/DECISIONS.md`. Não descarte silenciosamente requisitos. As decisões explícitas deste prompt e o PRD prevalecem, salvo impossibilidade técnica ou risco de segurança devidamente explicado.

## REGRA DE IMPLEMENTAÇÃO POR FASES

Trabalhe com marcos, sem pular os critérios de aceite:

### Fase 0 — Descoberta técnica e scaffold

1. Inspecione o repositório antes de modificar arquivos.
2. Se já existir código, preserve e avalie antes de reestruturar.
3. Verifique versões estáveis e documentação atual de Next.js, Supabase, OpenAI e Asaas. Não copie snippets antigos sem validar.
4. Crie app com TypeScript strict, lint, formatter, testes e validação de env.
5. Configure Supabase SSR corretamente com `@supabase/ssr` e cookies conforme a documentação vigente.
6. Crie `.env.example` sem valores reais e atualize README de instalação.
7. Não invente credenciais nem tente publicar recursos externos sem autorização.

### Fase 1 — Fundação, autenticação e multi-tenancy

1. Criar migrations versionadas para profiles, organizations e memberships.
2. Implementar cadastro, login, logout, recovery e onboarding.
3. Criar organização e membership owner.
4. Implementar resolução da organização ativa no servidor.
5. Implementar RBAC e RLS; `organization_id` não pode ser confiado ao browser.
6. Criar testes de isolamento cross-tenant usando dois usuários e duas organizações.
7. Não avançar enquanto testes de segurança falharem.

### Fase 2 — Shell visual e design system

1. Implementar sidebar, topbar, seletor de organização e navegação.
2. Replicar a direção visual do protótipo: dark, roxo tecnológico, marketing/analytics, cards e gráficos com hierarquia clara.
3. Criar tokens de cor, tipografia, raio, espaçamento, sombras e estados.
4. Implementar responsividade, acessibilidade, loading, empty, error e success states.
5. Construir dashboard com dados reais (ou fixtures isoladas e claramente marcadas durante desenvolvimento).

### Fase 3 — Empresas e prospecção

1. Implementar cadastro manual e CSV primeiro.
2. Criar importação com mapeamento de colunas, preview, validação e relatório de erros.
3. Criar contrato `BusinessDataProvider` e adaptadores isolados.
4. Integrar o primeiro provedor real somente após verificar política de uso, custos, atribuição, cache e retenção.
5. Implementar pesquisas assíncronas e paginação.
6. Registrar fonte e momento da coleta.
7. Implementar deduplicação conservadora; não unir empresas apenas por nome.
8. Permitir conversão explícita para lead com verificação de duplicidade em transação.

### Fase 4 — CRM

1. Criar pipeline stages configuráveis.
2. Implementar lista, filtros, busca, Kanban e detalhes do lead.
3. Implementar contatos, interações, timeline, tarefas, prioridade e próxima ação.
4. Registrar histórico de mudança de estágio.
5. Implementar regras de negócio e testes.

### Fase 5 — OpenAI

1. Criar `AIProvider` e `AIEngine` server-side.
2. Usar Responses API e SDK/documentação vigentes.
3. Implementar Company Analyzer, Lead Scorer e Outreach Generator.
4. Utilizar Structured Outputs/JSON Schema quando suportado e validar novamente com Zod.
5. Registrar modelo, prompt version, input/output tokens, custo estimado, duração e status.
6. Implementar quotas por organização antes de chamar o provedor.
7. Criar Copilot com ferramentas allowlist. O modelo não pode executar SQL arbitrário nem receber credenciais.
8. Validar permissões em cada execução de ferramenta.
9. Exigir confirmação humana para alteração sensível, comunicação externa ou ação irreversível.
10. Tratar refusal, timeout, rate limit, resposta incompleta e falha do provedor.
11. Tratar conteúdo de sites, CSV e mensagens como dado não confiável; proteger contra prompt injection.

### Fase 6 — Asaas

1. Criar planos e entitlements no banco.
2. Criar `AsaasProvider` com base URL por ambiente (Sandbox/Produção).
3. O backend calcula preço/plano; não aceitar valor do cliente.
4. Criar customer e checkout recorrente hospedado conforme API atual.
5. Guardar IDs externos de customer, checkout, subscription e payment.
6. Criar webhook endpoint autenticado com token configurado.
7. Persistir evento e usar o ID do evento como chave idempotente.
8. Processar evento em fila e sincronizar cobrança/assinatura.
9. O redirect de checkout nunca ativa a assinatura.
10. Testar sucesso, pagamento pendente, falha, atraso, cancelamento, renovação, evento duplicado e evento desconhecido no Sandbox.
11. Não armazenar dados de cartão.

### Fase 7 — Serviços, propostas, dashboard e relatórios

Implementar conforme backlog, sem misturar billing SaaS com valores de negócio do assinante. Métricas precisam de definição única e testável.

### Fase 8 — Hardening e beta

Executar testes de segurança, RLS, performance, responsividade, acessibilidade, fluxos de cobrança, logs, backups e documentação. Não afirmar que o sistema está pronto para produção sem revisar as evidências dos testes.

## REGRAS DE CÓDIGO

- TypeScript strict; evitar `any` e casts sem justificativa.
- Componentes UI pequenos e reutilizáveis; regras de negócio em módulos/services.
- Validar todas as entradas no servidor com Zod.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ASAAS_API_KEY` ou token de webhook em código cliente, logs ou exemplos com valor real.
- Nunca usar `NEXT_PUBLIC_` em segredo.
- Nunca permitir acesso cross-tenant.
- Nunca confiar em `organization_id`, preço, plano ou status de pagamento enviados pelo browser.
- SQL sempre via migrations versionadas; não depender apenas de alterações manuais no Dashboard.
- Criar índices para filtros e colunas de RLS.
- Valores monetários em `numeric`, não `float`.
- Datas em UTC no banco e timezone de organização na interface.
- Usar transações para conversão empresa→lead e atualizações financeiras/estado críticas.
- Operações demoradas em fila persistente com retry, backoff, idempotência e dead-letter.
- Evitar fake data em produção. Fixtures devem ficar em seed/dev e ser identificadas.
- Não criar botões sem ação funcional; não deixar links `#` sem destino.
- Não afirmar que integração foi validada sem chamada real em Sandbox ou teste com mock claramente identificado.
- Não implementar scraping contrário a termos de terceiros.

## CRITÉRIOS DE QUALIDADE

Para cada feature:

1. Implementar caso feliz e erros.
2. Implementar autorização e RLS.
3. Adicionar loading, empty, error e success states.
4. Adicionar testes unitários/integração/E2E adequados.
5. Atualizar documentação.
6. Executar lint, typecheck e testes.
7. Listar arquivos criados/alterados e limitações.

## INTERFACE E TELAS

Construir ao menos estas rotas/telas:

- `/login`
- `/register`
- `/dashboard`
- `/prospecting`
- `/companies/[id]`
- `/leads`
- `/leads/[id]`
- `/pipeline`
- `/assistant`
- `/services`
- `/proposals`
- `/reports`
- `/billing`
- `/settings`

A navegação deve refletir o protótipo, mas a experiência final precisa ser responsiva e acessível. Usar ícones consistentes (Lucide ou equivalente), gráficos legíveis, cores semânticas e componentes de estado.

## CRITÉRIOS DE ACEITE DO MVP

- Cadastro, login e organização funcionais.
- RLS bloqueia acesso cruzado, comprovado por testes.
- Cadastro manual e importação CSV.
- Primeiro provedor real de busca ou integração explicitamente configurada em Sandbox.
- Resultados mostram fonte, atribuição e data.
- Empresa vira lead somente após seleção; duplicidade impedida.
- Kanban e tabela funcionais.
- Timeline, tarefas e histórico.
- OpenAI analisa empresa e gera rascunho com saída validada e custo registrado.
- Copilot consulta somente dados autorizados via ferramentas.
- Asaas checkout Sandbox e webhook autenticado/idempotente.
- Limites de plano respeitados no servidor.
- Testes E2E dos fluxos críticos.
- README de setup e `.env.example` atualizados.

## PRIMEIRA RESPOSTA/PRIMEIRO CICLO DE TRABALHO

Antes de escrever código, faça o seguinte:

1. Confirme que leu os arquivos do pacote.
2. Inspecione o repositório e informe o estado atual.
3. Identifique divergências, riscos ou pontos ainda sem credenciais/decisão.
4. Apresente um plano curto com os primeiros arquivos/migrations que serão criados.
5. Comece pela Fase 0 e Fase 1; não implemente telas desconectadas do modelo de dados.
6. Entregue código e testes reais, não apenas instruções.

Se faltar uma chave de API, implemente a interface do provider, mock de teste claramente isolado e documentação de configuração; não interrompa todo o desenvolvimento nem invente uma chave. Se uma documentação externa mudou, siga a fonte oficial atual e registre a decisão.

## FORMATO DE RELATÓRIO AO FINAL DE CADA FASE

- O que foi implementado.
- Arquivos criados/alterados.
- Migrations executadas/pendentes.
- Variáveis de ambiente necessárias (sem valores secretos).
- Testes executados e resultados.
- Como executar localmente.
- Limitações, riscos e próximos itens do backlog.

**Comece agora pela inspeção do repositório e pela Fase 0.**
