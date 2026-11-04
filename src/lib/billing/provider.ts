import "server-only";

/**
 * Contrato `AsaasProvider` (Fase 6, item 2 do EPIC 07 —
 * docs/05-integrations.md §5.2): isola a API do Asaas do restante do
 * domínio, no mesmo espírito do `AIProvider` da Fase 5
 * (`src/lib/ai/provider.ts`). Nenhum módulo de negócio chama a API do
 * Asaas diretamente — só através desta interface.
 */

export type AsaasSubscriptionStatus = "ACTIVE" | "EXPIRED" | "INACTIVE";

export interface CreateCustomerInput {
  name: string;
  /** Apenas dígitos (CPF ou CNPJ) — normalizado antes de chegar aqui. */
  cpfCnpj: string;
  email: string;
  /** `organization_id` interno — persistido no Asaas como referência cruzada. */
  externalReference: string;
}

export interface CreateCustomerResult {
  externalCustomerId: string;
}

export interface CreateSubscriptionCheckoutInput {
  externalCustomerId: string;
  /** Nome do plano, exibido no item do checkout. */
  planName: string;
  planDescription: string | null;
  /** Preço mensal (ou do ciclo definido em `cycle`) em BRL. */
  value: number;
  cycle: "MONTHLY";
  /** Data do primeiro vencimento, formato `YYYY-MM-DD HH:mm:ss`. */
  nextDueDate: string;
  /** `organization_subscriptions.id` interno — vira `externalReference` no Asaas quando suportado. */
  externalReference: string;
  callback: {
    successUrl: string;
    cancelUrl: string;
    expiredUrl: string;
  };
}

export interface CreateSubscriptionCheckoutResult {
  externalCheckoutId: string;
  checkoutUrl: string;
}

export interface AsaasSubscriptionSnapshot {
  externalSubscriptionId: string;
  status: AsaasSubscriptionStatus;
  value: number;
  cycle: string;
  nextDueDate: string | null;
  /** Identificador do checkout de origem (`checkoutSession`), quando disponível — usado para correlacionar `SUBSCRIPTION_CREATED` com a linha local antes de aprendermos o `externalSubscriptionId`. */
  checkoutSessionId: string | null;
  deleted: boolean;
}

export type AsaasProviderResultStatus = "ok" | "not_found" | "failed";

export interface AsaasProviderResult<T> {
  status: AsaasProviderResultStatus;
  data: T | null;
  errorMessage?: string;
}

export interface AsaasProvider {
  createCustomer(input: CreateCustomerInput): Promise<AsaasProviderResult<CreateCustomerResult>>;
  createSubscriptionCheckout(
    input: CreateSubscriptionCheckoutInput,
  ): Promise<AsaasProviderResult<CreateSubscriptionCheckoutResult>>;
  getSubscription(
    externalSubscriptionId: string,
  ): Promise<AsaasProviderResult<AsaasSubscriptionSnapshot>>;
}

export class AsaasProviderNotConfiguredError extends Error {
  constructor() {
    super(
      "Billing (Asaas) ainda não configurado neste ambiente. Defina ASAAS_API_KEY, ASAAS_API_BASE_URL e ASAAS_WEBHOOK_TOKEN.",
    );
    this.name = "AsaasProviderNotConfiguredError";
  }
}

/**
 * Implementação honesta usada quando o Asaas não está configurado
 * (mesmo papel do `NotConfiguredAIProvider` da Fase 5): nunca finge
 * sucesso, sempre lança o erro de configuração ausente para o chamador
 * decidir a mensagem de UI (zero-state, não erro genérico).
 */
export class NotConfiguredAsaasProvider implements AsaasProvider {
  async createCustomer(): Promise<AsaasProviderResult<CreateCustomerResult>> {
    throw new AsaasProviderNotConfiguredError();
  }
  async createSubscriptionCheckout(): Promise<
    AsaasProviderResult<CreateSubscriptionCheckoutResult>
  > {
    throw new AsaasProviderNotConfiguredError();
  }
  async getSubscription(): Promise<AsaasProviderResult<AsaasSubscriptionSnapshot>> {
    throw new AsaasProviderNotConfiguredError();
  }
}
