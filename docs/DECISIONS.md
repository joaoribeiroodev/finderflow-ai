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
| RLS / isolamento cross-tenant | Teste de integração escrito em `tests/integration/rls-cross-tenant.test.ts`, **não executado neste ambiente** | O ambiente de execução não tem o daemon Docker ativo (`supabase start` falha: `dial unix /var/run/docker.sock`), então não foi possível subir o stack local do Supabase para rodar o teste real de dois usuários/duas organizações. O teste está pronto (`npm run test:rls`) e deve ser executado antes de avançar para a Fase 2, conforme a regra "não avançar enquanto testes de segurança falharem". |
| Organização ativa | Cookie `ff_active_org` (httpOnly) guarda apenas uma *preferência* de UI; a cada leitura o servidor revalida via `organization_members` sob RLS | Evita confiar em `organization_id` vindo do browser, conforme exigido. |
| Shell visual | Layout de workspace mínimo (topbar funcional) nesta fase; sidebar completa e design system ficam para a Fase 2 | Evita construir telas desconectadas do modelo de dados antes da hora, conforme instrução do prompt mestre. |
