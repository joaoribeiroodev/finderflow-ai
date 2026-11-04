# 8. Segurança, privacidade e operação

## 8.1. LGPD e governança de dados

O produto pode tratar dados de pessoas naturais que trabalham nas empresas prospectadas (nome, e-mail profissional, telefone e histórico de conversas). O fato de o dado estar público não significa autorização irrestrita para qualquer tratamento.

Requisitos:

- Definir controlador, operadores e responsabilidades contratuais.
- Registrar fonte, momento da coleta, finalidade e base legal avaliada.
- Minimizar campos coletados e enviados à IA.
- Publicar Termos de Uso e Política de Privacidade.
- Disponibilizar canal para solicitações de titulares.
- Implementar exportação, correção e exclusão quando aplicável.
- Respeitar oposição a contato e manter supressão para evitar reimportação/abordagem indevida.
- Definir prazos de retenção para pesquisas, resultados, mensagens, logs e documentos.
- Formalizar contratos/termos com fornecedores e revisar transferências internacionais.
- Não coletar categorias sensíveis ou dados pessoais desnecessários para prospecção.

Este documento não substitui avaliação jurídica ou parecer de encarregado/DPO.

## 8.2. Segurança de aplicação

- RLS habilitado para todas as tabelas tenant-scoped.
- RBAC no servidor, além de RLS.
- `organization_id` resolvido do contexto autenticado; nunca confiar em valor enviado pelo cliente.
- Chaves secretas exclusivamente no backend.
- Rotação de secrets e separação de ambientes.
- CORS restritivo para endpoints externos.
- Rate limiting por IP, usuário e organização.
- Validação de todos os dados com schemas.
- Proteção CSRF conforme mecanismos do framework e tipo de endpoint.
- Sanitização de conteúdo renderizado; nunca injetar HTML do fornecedor sem sanitização.
- Upload seguro: tamanho, MIME, extensão, antivírus/escaneamento quando viável e bucket privado.
- Logs estruturados com redaction de PII, tokens e payload financeiro.
- Auditoria de ações administrativas e financeiras.

## 8.3. Segurança de integrações

### OpenAI

- API key no secret manager.
- Tool calling com allowlist e validação de parâmetros.
- Conteúdo de páginas, CSV e mensagens é entrada não confiável.
- Não permitir SQL livre, execução de código, envio de mensagem ou exclusão pela IA sem confirmação.
- Limitar tokens e chamadas por plano.
- Guardar versão do prompt e do modelo usado.

### Asaas

- API key e token de webhook em secret manager.
- Não armazenar dados de cartão.
- Validar autenticação de webhook conforme documentação vigente.
- Persistir evento e aplicar idempotência.
- Conciliar estado com API quando webhook falhar.
- Nunca liberar acesso com base apenas em redirect/querystring.

### Provedores de empresas

- Respeitar termos, rate limits, atribuição e cache.
- Não usar scraping que viole termos de uso.
- Exibir a origem do dado e data de atualização.
- Permitir que o usuário corrija informações.

## 8.4. Backups e recuperação

- Habilitar backups apropriados ao plano Supabase.
- Definir RPO/RTO alvo antes do lançamento.
- Testar restauração periodicamente.
- Backups não substituem exportação e plano de recuperação.
- Não executar alteração destrutiva de schema sem migration revisada e plano de rollback.

## 8.5. Observabilidade

Registrar:

- request ID/correlation ID;
- organização e usuário (identificadores internos não sensíveis);
- endpoint/serviço;
- duração e status;
- provedor externo e resultado;
- job ID e tentativas;
- tokens e custo IA;
- evento de webhook e status de processamento.

Monitorar erros 5xx, latência, jobs presos, falhas de webhook, quota OpenAI, limite de provedor, taxa de falha de importação e divergência de assinatura.

## 8.6. Tratamento de falhas

- Timeout e retry apenas para operações idempotentes ou com chave de idempotência.
- Backoff exponencial com jitter.
- Circuit breaker para falha repetida de fornecedor.
- Dead-letter queue para jobs esgotados.
- Mensagem de erro legível para usuário; detalhes técnicos ficam nos logs.
- Não repetir cobrança ou criação de checkout sem verificar operação anterior.

## 8.7. Segurança de produto e IA

- Explicar quando um conteúdo foi gerado por IA.
- Distinguir fato observado de hipótese.
- Permitir revisão antes de comunicação externa.
- Não criar score discriminatório com dados sensíveis.
- Não inferir características pessoais irrelevantes.
- Oferecer exclusão/retention de conversas conforme política.

## 8.8. Checklist pré-produção

- [ ] Dois tenants testados com tentativa de acesso cruzado.
- [ ] RLS revisada por tabela e operação.
- [ ] Service role e secrets fora do frontend.
- [ ] HTTPS e domínio configurados.
- [ ] Rate limits ativos.
- [ ] Asaas Sandbox aprovado em sucesso, falha, atraso, cancelamento e duplicidade de webhook.
- [ ] OpenAI timeout, rate limit, refusal e saída inválida tratados.
- [ ] Fonte de dados aprovada juridicamente/contratualmente para uso comercial.
- [ ] Termos/Política de Privacidade publicados.
- [ ] Backups e restauração testados.
- [ ] Logs e alertas configurados.
- [ ] Testes E2E e acessibilidade básica aprovados.
- [ ] Processo de suporte e incidente documentado.
