# Termos de Uso do FinderFlow AI

> **AVISO — ESTE É UM RASCUNHO PLACEHOLDER, NÃO UM DOCUMENTO JURÍDICO
> VALIDADO.** Escrito durante a Fase 8 (hardening) para que o produto
> tenha algo publicável e honesto antes do beta, não para substituir
> revisão por advogado. Não afirmar em nenhum material de marketing ou
> comunicação com assinantes que estes Termos foram aprovados
> juridicamente até que isso de fato aconteça. Ver `docs/DECISIONS.md`
> "Decisões pendentes antes do beta comercial", item 7.
>
> Lacunas conhecidas deste rascunho que precisam de decisão de negócio
> antes de produção real: SLA de disponibilidade, foro/jurisdição,
> política de reembolso detalhada, limite de responsabilidade em R$,
> processo formal de encerramento de conta por violação.

## 1. Quem somos e o que é o FinderFlow AI

O FinderFlow AI é um SaaS de prospecção B2B, CRM e inteligência comercial
com IA, operado por [RAZÃO SOCIAL A DEFINIR]. Ao criar uma conta ou usar o
produto, você ("Assinante") concorda com estes Termos.

## 2. Conta e organização

- Cada assinante opera dentro de uma ou mais "organizações" (tenants),
  isoladas entre si — dados de uma organização nunca são visíveis para
  outra.
- Você é responsável por manter a confidencialidade das credenciais de
  acesso e por toda atividade realizada com sua conta.
- Podemos suspender ou encerrar contas que violem estes Termos, a
  legislação aplicável, ou os termos de uso de integrações de terceiros
  (OpenAI, Asaas, provedores de dados de empresas).

## 3. Uso aceitável

Você concorda em **não**:

- usar o produto para coletar, armazenar ou tratar dados pessoais fora do
  que é necessário para prospecção B2B legítima;
- importar listas obtidas por scraping que viole termos de uso de
  terceiros;
- enviar comunicação comercial não solicitada em violação à legislação
  aplicável (ex.: LGPD, Marco Civil da Internet) ou aos termos dos canais
  usados;
- tentar acessar dados de outra organização, contornar limites de
  quota/plano, ou realizar testes de intrusão sem autorização expressa.

## 4. Conteúdo gerado por Inteligência Artificial

- Funcionalidades de IA (análise de empresa, qualificação de lead,
  geração de abordagem, assistente de propostas, Copilot, Sales Analyst)
  geram **sugestões**, nunca decisões automáticas finais. Você é
  responsável por revisar qualquer conteúdo gerado por IA antes de
  enviá-lo a terceiros ou agir com base nele.
- O FinderFlow AI não garante a exatidão, completude ou atualidade de
  conteúdo gerado por IA.
- Scores e qualificações de lead são calculados por uma fórmula
  determinística e documentada (nunca um "índice de intenção de compra"
  inferido sem base) — ver `docs/DECISIONS.md` Fase 5.

## 5. Dados de empresas prospectadas (terceiros)

- O FinderFlow AI trata dados de pessoas naturais que trabalham nas
  empresas prospectadas (nome, cargo, e-mail profissional, telefone)
  apenas na medida necessária para a finalidade de prospecção comercial
  B2B declarada pelo Assinante.
- O Assinante é o controlador desses dados no sentido da LGPD; o
  FinderFlow AI atua como operador. Ver Política de Privacidade.
- O Assinante é responsável por ter base legal adequada para contatar
  as pessoas prospectadas e por respeitar pedidos de oposição a contato.

## 6. Cobrança

- Planos, preços, limites e trial são os vigentes no momento da assinatura
  e podem ser revisados com aviso prévio.
- O processamento de pagamentos é feito pelo Asaas; o FinderFlow AI nunca
  armazena dados de cartão.
- A liberação/restrição de recursos pagos segue o status da assinatura
  confirmado pelo provedor de pagamento (webhook/conciliação), nunca o
  retorno de uma URL de checkout.
- Inadimplência após o período de tolerância restringe recursos de IA
  sem apagar dados.

## 7. Disponibilidade e suporte

- Buscamos manter o serviço disponível, mas não garantimos um SLA
  específico neste rascunho (pendente de definição comercial).
- Canais de suporte e processo de incidentes: ver
  `docs/09-suporte-e-incidentes.md`.

## 8. Propriedade e dados do Assinante

- Os dados inseridos pelo Assinante (empresas, leads, propostas, etc.)
  pertencem ao Assinante. O FinderFlow AI não vende nem compartilha esses
  dados com terceiros fora do necessário para operar o produto (ex.:
  provedores de IA e pagamento, estritamente para processar a
  funcionalidade solicitada).
- Ao encerrar a conta, o Assinante pode solicitar exportação dos seus
  dados — ver Política de Privacidade §5.

## 9. Limitação de responsabilidade

Na extensão máxima permitida pela lei aplicável, o FinderFlow AI não será
responsável por danos indiretos, lucros cessantes, ou perda de dados
decorrentes do uso do produto, exceto em casos de dolo ou culpa grave.
*(Cláusula placeholder — valor de limite e exceções precisam de revisão
jurídica antes de produção.)*

## 10. Alterações destes Termos

Podemos atualizar estes Termos. Mudanças materiais serão comunicadas com
aviso prévio razoável pelos canais da conta.

## 11. Contato

Dúvidas sobre estes Termos: [E-MAIL DE CONTATO A DEFINIR].
