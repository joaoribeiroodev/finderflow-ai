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

1. **Provedor principal de empresas:** avaliar cobertura em cidades brasileiras, campos disponíveis, preço, quotas, licença de uso comercial, cache, atribuição e SLA.
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
| Migration de schema | Migration de referência (`supabase/migrations/20261104000000_core_schema.sql`) tinha um bug: `ai_conversations` não declarava `unique (organization_id, id)`, e a FK composta de `ai_messages` para essa tabela falhava (`42830`) | Corrigido adicionando a constraint, seguindo o mesmo padrão já usado em todas as outras tabelas do schema. Aplicada com sucesso no projeto real: 29 tabelas criadas, todas com RLS habilitado. |
| Privilégios de funções `SECURITY DEFINER` | `get_advisors(type="security")` logo após aplicar o schema apontou que o role `anon` conseguia executar 5 funções sensíveis (`is_org_member`, `has_org_role`, `can_edit_org`, `can_admin_org`, `create_organization_with_defaults`) e `handle_new_auth_user`, apesar da migration já ter `revoke all ... from public` | Causa raiz: o provisionamento do Supabase concede EXECUTE diretamente ao role `anon` (grant nomeado) na criação da função — `REVOKE ... FROM PUBLIC` não remove esse grant. Corrigido com a migration `supabase/migrations/20261104143356_fix_function_privileges.sql` (revoga de `public, anon` nas 5 funções e concede só para `authenticated`; revoga totalmente de `handle_new_auth_user` e `set_updated_at`, que são só para uso via trigger). Também corrigido o aviso `function_search_path_mutable` em `set_updated_at` fixando `search_path = public`. Reverificado via `pg_proc.proacl` e um segundo `get_advisors`: `anon` sem acesso, aviso de search_path limpo. O WARN remanescente (`authenticated_security_definer_function_executable`, 5 ocorrências) e o INFO `rls_enabled_no_policy` em `asaas_webhook_events` (RLS habilitado, sem policies — tabela só deve ser tocada pela `service_role`, que ignora RLS) são avaliados como **intencionais**, não pendências. |
| Tipos do banco | `src/types/database.ts` regenerado via `mcp__Supabase__generate_typescript_types` contra o projeto real | Substitui o arquivo escrito manualmente na Fase 0/1. `OrgRole` agora é extraído do enum `org_role` gerado (nunca diverge do banco); `MemberStatus` continua manual porque `status` em `organization_members` é `text` com check constraint, não um enum do Postgres. |
| Organização ativa | Cookie `ff_active_org` (httpOnly) guarda apenas uma *preferência* de UI; a cada leitura o servidor revalida via `organization_members` sob RLS | Evita confiar em `organization_id` vindo do browser, conforme exigido. |
| Shell visual | Layout de workspace mínimo (topbar funcional) nesta fase; sidebar completa e design system ficam para a Fase 2 | Evita construir telas desconectadas do modelo de dados antes da hora, conforme instrução do prompt mestre. |

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
