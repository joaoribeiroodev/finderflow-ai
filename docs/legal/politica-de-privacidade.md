# Política de Privacidade do FinderFlow AI

> **AVISO — ESTE É UM RASCUNHO PLACEHOLDER, NÃO UM PARECER JURÍDICO OU
> DE DPO.** Escrito durante a Fase 8 (hardening) com base no que o
> sistema de fato faz hoje (verificável no código/schema), não a partir
> de um mapeamento formal de dados conduzido por um encarregado. Antes de
> publicar como documento final, revisar com um profissional de
> privacidade/DPO e confrontar linha a linha com `docs/08-security-
> operations.md` §8.1. Lacunas conhecidas: prazos de retenção exatos
> (hoje "indefinido" na prática — ver `docs/DECISIONS.md` item 5 das
> decisões pendentes), canal formal de atendimento a titulares, e análise
> de transferência internacional de dados (OpenAI/Asaas podem processar
> dados fora do Brasil).

## 1. Controlador e operador

- O **Assinante** (organização que usa o FinderFlow AI) é o **controlador**
  dos dados das empresas/pessoas que prospecta.
- O **FinderFlow AI** atua como **operador** desses dados, processando-os
  apenas conforme instruído pelo Assinante e para a finalidade de
  prospecção B2B.
- Para os dados da própria conta do Assinante (nome, e-mail de login,
  dados de faturamento), o FinderFlow AI é o controlador.

## 2. Quais dados tratamos

| Categoria | Exemplos | Finalidade |
|---|---|---|
| Dados de conta | nome, e-mail, senha (hash), organização | Autenticação e operação da conta |
| Dados de faturamento | nome/razão social, CPF/CNPJ, e-mail de cobrança | Emitir cobrança via Asaas (nunca dados de cartão) |
| Dados de empresas/leads prospectados | nome da empresa, CNPJ, contatos profissionais, histórico de interação | Prospecção B2B conduzida pelo Assinante |
| Conteúdo enviado à IA | descrições de empresa, mensagens do Copilot, CSV importado | Gerar análises/sugestões de IA (nunca usado para treinar modelos de terceiros, conforme política do provedor de IA) |
| Logs técnicos | IP, timestamp, endpoint, status, duração | Segurança, depuração, observabilidade — nunca conteúdo de mensagens ou segredos (ver `src/lib/logger/logger.ts`, redação automática) |

Minimizamos deliberadamente: não coletamos nem enviamos à IA campos além
dos necessários para cada funcionalidade (ex.: o Lead Scorer nunca recebe
dados sensíveis para calcular o score — pesos fixos e documentados, ver
`docs/DECISIONS.md` Fase 5).

## 3. Base legal (LGPD)

O tratamento de dados de pessoas prospectadas pelo Assinante normalmente
se baseia em **legítimo interesse** para contato comercial B2B, sujeito a
avaliação caso a caso pelo próprio Assinante (controlador) — o FinderFlow
AI não avalia nem garante a base legal de cada prospecção individual.
Dados da própria conta são tratados com base em **execução de contrato**.

## 4. Compartilhamento com terceiros

Processamos dados através de:

- **Supabase** (banco de dados e autenticação) — hospedagem conforme
  região configurada do projeto.
- **OpenAI** (funcionalidades de IA) — apenas o conteúdo mínimo necessário
  para cada chamada estruturada; nunca se envia senha, token, ou dado de
  cartão.
- **Asaas** (processamento de pagamento) — dados de faturamento, nunca
  dado de cartão.

Não vendemos dados a terceiros nem os usamos para publicidade.

## 5. Direitos do titular

Qualquer pessoa cujos dados tratamos pode solicitar acesso, correção,
exclusão ou portabilidade. Para dados de prospecção, a solicitação deve
ser direcionada preferencialmente ao Assinante (controlador); quando
chegar a nós, retransmitimos ao Assinante responsável e, quando aplicável
tecnicamente, atendemos a solicitação diretamente. Canal de contato:
[E-MAIL/CANAL A DEFINIR — pendência, ver `docs/08-security-
operations.md` checklist].

## 6. Oposição a contato

Uma pessoa prospectada que se opuser a contato deve ter essa preferência
registrada e respeitada pelo Assinante, inclusive para evitar reimportação
futura do mesmo contato. *(Mecanismo de supressão automática ainda não
implementado no produto — pendência registrada aqui, não escondida.)*

## 7. Retenção

Prazos de retenção específicos por tipo de dado (resultados de busca,
histórico de IA, conversas, logs) ainda não foram formalmente definidos —
ver `docs/DECISIONS.md`, item 5 das decisões pendentes antes do beta
comercial. Até essa definição, os dados permanecem enquanto a conta
estiver ativa.

## 8. Segurança

Aplicamos isolamento por organização via RLS no banco de dados (testado
com dois tenants reais na Fase 8 — nenhum acesso cruzado foi possível),
segredos nunca expostos ao cliente, e logs com redação automática de
PII/segredos. Ver `docs/08-security-operations.md` para o programa
completo de segurança.

## 9. Alterações

Esta política pode ser atualizada; mudanças materiais serão comunicadas
pelos canais da conta.

## 10. Contato do encarregado (DPO)

[A DEFINIR — não há encarregado formalmente designado neste rascunho.]
