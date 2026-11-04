# 4. Contratos de API

## 4.1. Padrões

- Prefixo `/api/v1` recomendado para endpoints próprios.
- JSON UTF-8.
- Autenticação por sessão Supabase; não aceitar `organization_id` como prova de autorização.
- O backend resolve usuário, organização ativa e papel.
- Validar entrada com Zod no servidor.
- Paginação padrão: `limit=25`, máximo 100; `cursor`/`offset` documentado.
- Resposta de sucesso: `{ "data": ..., "meta": ... }`.
- Resposta de erro: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.
- Nunca incluir stack trace ou segredo em resposta pública.

## 4.2. Autenticação e organização

A autenticação é fornecida pelo Supabase Auth. Endpoints próprios:

| Método | Endpoint | Ação |
|---|---|---|
| GET | `/api/v1/me` | Perfil e organizações disponíveis |
| POST | `/api/v1/organizations` | Criar organização |
| GET | `/api/v1/organizations/current` | Organização ativa |
| PATCH | `/api/v1/organizations/current` | Atualizar preferências |
| GET | `/api/v1/organizations/current/members` | Listar membros |
| POST | `/api/v1/organizations/current/invitations` | Convidar membro |
| PATCH | `/api/v1/organizations/current/members/:id` | Alterar papel/status |

## 4.3. Prospecção

| Método | Endpoint | Ação |
|---|---|---|
| POST | `/api/v1/searches` | Criar pesquisa/novo job |
| GET | `/api/v1/searches` | Listar pesquisas |
| GET | `/api/v1/searches/:id` | Status e resumo |
| GET | `/api/v1/searches/:id/results` | Resultados paginados |
| POST | `/api/v1/searches/:id/convert` | Converter resultados selecionados em leads |
| POST | `/api/v1/companies/imports` | Criar importação CSV |
| GET | `/api/v1/companies/imports/:id` | Resultado da importação |
| POST | `/api/v1/companies` | Cadastro manual |
| GET | `/api/v1/companies/:id` | Detalhes de empresa |

Exemplo de pesquisa:

```json
{
  "term": "restaurantes",
  "segment": "Alimentação",
  "location": { "state": "BA", "city": "Salvador" },
  "filters": { "website": "missing", "phone": "available" },
  "providers": ["primary_provider"]
}
```

Resposta assíncrona:

```json
{
  "data": {
    "searchId": "uuid",
    "jobId": "uuid",
    "status": "queued"
  }
}
```

Conversão:

```json
{
  "data": {
    "createdLeadIds": ["uuid"],
    "skippedDuplicates": ["company-uuid"],
    "errors": []
  }
}
```

A conversão deve acontecer em transação. O servidor revalida que cada `company_id` pertence à organização e que o usuário pode criar lead.

## 4.4. CRM

| Método | Endpoint | Ação |
|---|---|---|
| GET | `/api/v1/leads` | Listar e filtrar leads |
| POST | `/api/v1/leads` | Criar lead a partir de empresa autorizada |
| GET | `/api/v1/leads/:id` | Detalhes |
| PATCH | `/api/v1/leads/:id` | Atualizar campos permitidos |
| PATCH | `/api/v1/leads/:id/stage` | Mover etapa |
| GET | `/api/v1/leads/:id/timeline` | Histórico |
| POST | `/api/v1/leads/:id/interactions` | Registrar interação |
| POST | `/api/v1/leads/:id/tasks` | Criar tarefa |
| PATCH | `/api/v1/tasks/:id` | Atualizar/concluir tarefa |
| GET | `/api/v1/pipeline` | Etapas e contagens |

## 4.5. IA

| Método | Endpoint | Ação |
|---|---|---|
| POST | `/api/v1/ai/analyze-company` | Executar Company Analyzer |
| POST | `/api/v1/ai/score-lead` | Recalcular score explicável |
| POST | `/api/v1/ai/generate-outreach` | Gerar rascunho de mensagem |
| POST | `/api/v1/ai/generate-followup` | Sugerir acompanhamento |
| POST | `/api/v1/ai/generate-proposal` | Rascunhar proposta |
| POST | `/api/v1/ai/conversations` | Criar conversa |
| POST | `/api/v1/ai/conversations/:id/messages` | Enviar mensagem ao Copilot |
| GET | `/api/v1/ai/usage` | Consultar consumo e limite |

O endpoint de IA cria registro de uso antes/depois da chamada, verifica quota e só aceita IDs de recursos que o usuário pode acessar. Ferramentas de function calling passam por um dispatcher com allowlist, autorização, schema e confirmação humana para ações externas ou irreversíveis.

## 4.6. Serviços, propostas e negócios

| Método | Endpoint | Ação |
|---|---|---|
| GET/POST | `/api/v1/services` | Listar/criar serviços |
| PATCH/DELETE | `/api/v1/services/:id` | Atualizar/desativar |
| GET/POST | `/api/v1/proposals` | Listar/criar propostas |
| GET/PATCH | `/api/v1/proposals/:id` | Detalhar/atualizar |
| POST | `/api/v1/proposals/:id/pdf` | Gerar PDF |
| GET/POST | `/api/v1/deals` | Listar/criar negócios |
| PATCH | `/api/v1/deals/:id` | Atualizar/encerrar |

## 4.7. Billing Asaas

| Método | Endpoint | Ação |
|---|---|---|
| GET | `/api/v1/billing/plans` | Listar planos ativos |
| GET | `/api/v1/billing/subscription` | Assinatura da organização |
| POST | `/api/v1/billing/checkout` | Criar checkout para plano selecionado |
| POST | `/api/v1/billing/cancel` | Solicitar cancelamento |
| GET | `/api/v1/billing/payments` | Listar cobranças da assinatura |
| POST | `/api/v1/webhooks/asaas` | Receber webhook (sem sessão de usuário, com autenticação do provedor) |

O frontend não pode informar preço final. O backend resolve plano/valor no banco. Guardar identificadores do Asaas. O checkout redireciona para ambiente hospedado e o webhook é a fonte de sincronização. Nunca ativar assinatura apenas pelo redirect.

## 4.8. Dashboard e relatórios

| Método | Endpoint | Ação |
|---|---|---|
| GET | `/api/v1/dashboard/summary` | KPIs para período |
| GET | `/api/v1/dashboard/pipeline` | Distribuição por etapa |
| GET | `/api/v1/reports/conversion` | Conversão |
| GET | `/api/v1/reports/segments` | Resultado por segmento |
| GET | `/api/v1/reports/revenue` | Receita por período |

Definições de métricas devem ficar em serviço/query centralizado para evitar valores divergentes entre telas.

## 4.9. Códigos de erro

| Código | HTTP | Significado |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | Sessão ausente/inválida |
| `FORBIDDEN` | 403 | Sem permissão |
| `NOT_FOUND` | 404 | Recurso inexistente ou fora do tenant |
| `VALIDATION_ERROR` | 400 | Entrada inválida |
| `CONFLICT` | 409 | Duplicidade/conflito de estado |
| `PLAN_LIMIT_REACHED` | 402 ou 429 | Limite do plano atingido (definir contrato uniforme) |
| `RATE_LIMITED` | 429 | Muitas requisições |
| `PROVIDER_ERROR` | 502 | Falha no serviço externo |
| `INTERNAL_ERROR` | 500 | Erro inesperado |

## 4.10. Idempotência

- Aceitar `Idempotency-Key` em operações de criação custosas/sensíveis.
- Guardar chave, organização, endpoint, hash do request e resposta por TTL.
- Webhooks Asaas usam o identificador de evento fornecido pelo Asaas como chave única.
- Jobs recebem chave de idempotência determinística.
- Repetição com o mesmo conteúdo retorna resultado anterior; mesmo ID com payload diferente deve ser conflito/auditoria.
