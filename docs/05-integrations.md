# 5. Especificação das integrações externas

## 5.1. OpenAI API

### Decisão

O provedor oficial de IA é a OpenAI API. Implementar por meio de `OpenAIProvider`/`AIService`, isolando SDK e endpoints do restante do domínio. Para novos fluxos, usar Responses API e a documentação vigente. Não iniciar implementação nova baseada em Assistants API, Threads ou Runs sem justificativa de compatibilidade.

### Casos de uso

- Análise estruturada de empresa.
- Qualificação explicável de lead.
- Recomendação de serviços do catálogo do assinante.
- Geração de rascunhos de abordagem e follow-up.
- Auxílio para propostas.
- Copilot que consulta ferramentas internas com permissões.

### Contrato interno de IA

```ts
export interface AIProvider {
  generateStructured<T>(input: StructuredAIInput<T>): Promise<AIResult<T>>;
  respond(input: ConversationInput): Promise<ConversationResult>;
}
```

`AIResult` deve conter: `data`, `model`, `responseId`, `usage`, `durationMs`, `status`, `promptKey`, `promptVersion`, `sources` e eventuais avisos. O serviço valida o resultado com Zod mesmo quando Structured Outputs é utilizado.

### Modelo e prompts

- `OPENAI_DEFAULT_MODEL` configurável por ambiente; não hardcode modelo em componente.
- Permitir configuração por tarefa (analyze, score, chat) e fallback definido.
- Não usar um modelo mais caro para tarefas simples quando uma opção menor e adequada atender.
- Manter prompts versionados no banco ou no código versionado com identificador; nunca editar prompt de produção silenciosamente.
- Medir tokens e custo estimado; preço por milhão de tokens em configuração atualizável.

### Structured Outputs

Usar JSON Schema estrito para análises e tarefas estruturadas quando o modelo suportar. Validar enums, intervalos, campos obrigatórios e referências antes de persistir. Tratar refusal, timeout, rate limit e resposta incompleta.

Formato de análise sugerido:

```json
{
  "summary": "string",
  "observations": [
    { "claim": "string", "evidence": "string", "source": "string", "confidence": "low|medium|high", "kind": "fact|inference" }
  ],
  "opportunities": [
    { "service_id": "uuid|null", "service_name": "string", "reason": "string", "priority": "low|medium|high" }
  ],
  "recommended_action": "string",
  "score": 0,
  "score_breakdown": [{ "criterion": "string", "weight": 0, "score": 0, "rationale": "string" }]
}
```

### Lead scoring

Peso inicial configurável: aderência ao serviço 25; necessidade observável 25; qualidade dos dados 15; aderência ao perfil ideal 15; facilidade de contato 10; sinais de interesse 10. Resultado 0–100 com justificativa. Não chamar o score de probabilidade de compra. Não atribuir pontos por ausência de website como fato de necessidade sem validação.

### Copilot e ferramentas

Ferramentas internas em allowlist, por exemplo `list_leads`, `get_lead_details`, `get_tasks_due`, `get_pipeline_metrics`, `get_sales_report`, `create_task` e `update_lead_stage`. Cada chamada é validada e executada no servidor com contexto tenant-scoped. O modelo não recebe SQL, credenciais ou acesso livre ao banco. Operações externas, envio de mensagem, exclusão e mudanças de alto impacto requerem confirmação explícita do usuário.

### Segurança e privacidade

- API key apenas no backend/secret manager.
- Minimizar dados pessoais enviados à OpenAI.
- Não incluir tokens, chaves, documentos sensíveis ou dados sem necessidade.
- Sanitizar conteúdo externo e instruir modelo a tratá-lo como dado não confiável (proteção contra prompt injection).
- Não confiar em conteúdo de website como instrução de sistema.
- Guardar somente mensagens/saídas necessárias conforme política de retenção.
- Registrar custo, não expor logs sensíveis a usuários.

## 5.2. Asaas — billing do FinderFlow

### Escopo

O Asaas recebe os pagamentos dos clientes que assinam o FinderFlow. Na primeira versão, **não** processa vendas que os assinantes realizam a seus próprios clientes.

### Fluxo recomendado

1. Resolver plano no banco e calcular preço no backend.
2. Criar/localizar cliente no Asaas.
3. Criar checkout hospedado configurado para cobrança recorrente conforme contrato atual.
4. Persistir ID do checkout e referências internas.
5. Redirecionar usuário.
6. Receber evento via webhook autenticado.
7. Persistir payload/event ID antes de processar.
8. Processar de forma idempotente e atualizar assinatura/pagamento.
9. Recalcular entitlements e registrar audit log.

### Requisitos técnicos

- Ambientes Sandbox e Produção separados.
- `ASAAS_API_BASE_URL` configurada por ambiente.
- API key e token de webhook em secrets server-side.
- Backend controla customer, preço, frequência, métodos e plano.
- Nunca confiar no redirect como confirmação de pagamento.
- Idempotência por ID do evento; retries não podem duplicar pagamento ou ativar plano indevidamente.
- Guardar somente dados financeiros necessários.
- Não armazenar dados de cartão.
- Tratar atualização/cancelamento de assinatura e estado de cada cobrança separadamente.
- Reconciliar periodicamente estado interno com consulta API quando houver falhas de webhook.
- Monitorar falhas e eventos não reconhecidos.

### Estados internos sugeridos

`incomplete`, `trialing`, `active`, `past_due`, `suspended`, `canceled`, `expired`. Mapear a partir dos estados e eventos atualmente documentados pelo Asaas. Não supor que nomes de eventos ou campos permaneçam constantes: conferir API reference/guia vigente na implementação.

### Webhook

- Endpoint isolado `/api/v1/webhooks/asaas` ou Edge Function dedicada.
- Sem sessão de usuário, mas com validação do segredo/token configurado no provedor.
- Payload armazenado em tabela inbox com `provider_event_id` único.
- Resposta rápida depois da persistência; processamento de negócio assíncrono.
- Tratar entrega at-least-once.
- Política para payload inválido, evento desconhecido e retries.
- Nunca logar token de autenticação.

### Inadimplência e cancelamento

Criar período de tolerância comercial configurável. Durante a tolerância, notificar usuário e definir quais recursos continuam ativos. Após o prazo, restringir recursos pagos sem apagar dados. Cancelamento deve respeitar regras de cobrança e período já pago, conforme contrato do Asaas e plano. Toda alteração é auditada.

## 5.3. Provedores de empresas

Criar uma interface `BusinessDataProvider` com `search`, `getDetails` e metadados de política. Adaptadores iniciais possíveis: Google Places API, serviço OSM contratado/instância apropriada, diretórios licenciados, CSV e entrada manual.

Cada adaptador deve declarar:

- Termos/licença e permissão para uso comercial.
- Campos retornados e atribuição exigida.
- Quais campos podem ser armazenados e por quanto tempo.
- Custos, quotas e rate limit.
- Paginação e identificadores externos.
- Tratamento de erros e timeout.

### Google Places

Utilizar API oficial e apresentar logo/atribuições conforme regras. Não presumir que todo conteúdo pode ser armazenado indefinidamente; Place ID possui exceção específica, mas outros conteúdos podem ter restrições de cache/armazenamento. Quando não for permitido persistir um campo, armazenar somente referência permitida e buscar detalhes conforme necessário.

### OpenStreetMap

Respeitar ODbL e atribuição. Não usar o endpoint público de Nominatim para busca em massa/serviço comercial com alto volume: possui política de uso e limites rígidos. Utilizar fornecedor apropriado, instância própria ou serviço contratado, observando as condições aplicáveis.

### CSV e manual

CSV será fonte fundamental do MVP. Importação deve oferecer mapeamento de colunas, validação, preview, relatório de linhas rejeitadas, normalização, dedupe e execução assíncrona para arquivos grandes. Registrar origem e responsável pela importação.

## 5.4. Integrações futuras

- WhatsApp Business Platform: apenas integração oficial e consentimento adequado; não automatizar WhatsApp Web.
- E-mail transacional: serviço dedicado a ser escolhido posteriormente.
- Google Calendar: opcional para compromissos.
- Asaas por assinante: futuro, com credenciais e isolamento próprios.

## 5.5. Referências oficiais para conferência durante implementação

- OpenAI API docs: https://developers.openai.com/api/docs
- Responses API: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Asaas docs: https://docs.asaas.com/
- Asaas Checkout: https://docs.asaas.com/docs/introduction-1
- Asaas webhooks: https://central.ajuda.asaas.com/hc/pt-br/articles/55668763565979-O-que-%C3%A9-e-como-funciona-o-Webhook-do-Asaas
- Supabase Next.js: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Google Places policies: https://developers.google.com/maps/documentation/places/web-service/policies
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
