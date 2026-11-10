-- Usuário pediu: opção do cliente pagar por cartão de crédito/débito nas
-- cobranças de Contratos (ver docs/DECISIONS.md, "Contratos: cartão de
-- crédito/débito"). A Asaas já aceita `billingType: "CREDIT_CARD"` no
-- mesmo endpoint de BOLETO/PIX — sem enviar dados de cartão, devolve
-- `invoiceUrl` normalmente, e a mesma página hospedada pela Asaas aceita
-- cartão de débito (não existe billingType de débito separado — a
-- bandeira decide). Só faltava a constraint do banco aceitar o valor.
alter table public.contract_charges
  drop constraint if exists contract_charges_billing_type_check;

alter table public.contract_charges
  add constraint contract_charges_billing_type_check
  check (billing_type in ('BOLETO', 'PIX', 'CREDIT_CARD', 'UNDEFINED'));
