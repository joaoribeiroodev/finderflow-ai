# FinderFlow AI

SaaS multi-tenant de prospecção B2B, CRM e inteligência comercial com IA.

> Status: **Fase 0/1 concluída** — fundação, autenticação e multi-tenancy,
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
- `TEST_SUPABASE_URL` / `TEST_SUPABASE_SERVICE_ROLE_KEY`: usados apenas pelo
  teste de integração de RLS (`npm run test:rls`), nunca em produção.

Se uma chave estiver ausente, o módulo correspondente permanece desabilitado
(`isOpenAiConfigured()`, `isAsaasConfigured()`, `isBusinessProviderConfigured()`
em `src/lib/env/env.server.ts`) em vez de quebrar o build — a interface do
provider existe, mas a chamada real só ocorre quando configurada.

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

## Segurança — regras que todo PR deve respeitar

- `organization_id` nunca é confiado a partir do browser — sempre resolvido/
  revalidado no servidor (`src/modules/organizations/active-organization.ts`).
- RLS é a defesa primária; `src/lib/permissions/permissions.ts` adiciona
  revalidação explícita antes de mutações, para mensagens de erro melhores.
- `SUPABASE_SERVICE_ROLE_KEY` só é usada em `src/lib/supabase/admin.ts`, nunca
  em código que pode ser bundlado para o cliente.
