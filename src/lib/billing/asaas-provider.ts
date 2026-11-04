import "server-only";

import { getServerEnv, isAsaasConfigured } from "@/lib/env/env.server";
import { logger } from "@/lib/logger/logger";

import type {
  AsaasProvider,
  AsaasProviderResult,
  AsaasSubscriptionSnapshot,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateSubscriptionCheckoutInput,
  CreateSubscriptionCheckoutResult,
} from "./provider";
import { NotConfiguredAsaasProvider } from "./provider";

/**
 * Implementação real sobre a API REST do Asaas (v3), conferida contra a
 * documentação oficial durante a implementação (docs.asaas.com —
 * `create-new-customer`, `creating-a-subscription`,
 * `checkout-with-subscription-recurring`), já que o prompt mestre pede
 * explicitamente para não supor nomes de campos/eventos (docs/05-integrations.md §5.5).
 *
 * Autenticação: header `access_token` com a API key (confirmado na
 * página de erros do endpoint de assinatura: "A 401 indicates an invalid
 * API key, which is sent in the access_token header").
 *
 * Não há SDK oficial maduro para Node — chamadas via `fetch` cru contra
 * `ASAAS_API_BASE_URL` (definida por ambiente: sandbox ou produção),
 * igual ao padrão recomendado pela documentação.
 */

const REQUEST_TIMEOUT_MS = 15_000;

export class AsaasProviderError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "AsaasProviderError";
  }
}

async function asaasFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        // Nunca logar este header — é a credencial da conta Asaas.
        access_token: apiKey,
        ...init.headers,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    const body = text.length > 0 ? JSON.parse(text) : null;
    return { status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

function friendlyErrorFromBody(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "errors" in body &&
    Array.isArray((body as { errors: unknown }).errors)
  ) {
    const errors = (body as { errors: Array<{ description?: string }> }).errors;
    const descriptions = errors.map((e) => e.description).filter(Boolean);
    if (descriptions.length > 0) return descriptions.join("; ");
  }
  return fallback;
}

export class AsaasProviderImpl implements AsaasProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly checkoutHost: string,
  ) {}

  async createCustomer(input: CreateCustomerInput): Promise<AsaasProviderResult<CreateCustomerResult>> {
    try {
      const { status, body } = await asaasFetch(this.baseUrl, this.apiKey, "/v3/customers", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          cpfCnpj: input.cpfCnpj,
          email: input.email,
          externalReference: input.externalReference,
        }),
      });

      if (status >= 200 && status < 300 && body && typeof body === "object" && "id" in body) {
        return { status: "ok", data: { externalCustomerId: String((body as { id: unknown }).id) } };
      }

      return {
        status: "failed",
        data: null,
        errorMessage: friendlyErrorFromBody(body, "Não foi possível cadastrar o cliente no Asaas."),
      };
    } catch (error) {
      return { status: "failed", data: null, errorMessage: classifyFetchError(error) };
    }
  }

  async createSubscriptionCheckout(
    input: CreateSubscriptionCheckoutInput,
  ): Promise<AsaasProviderResult<CreateSubscriptionCheckoutResult>> {
    try {
      const { status, body } = await asaasFetch(this.baseUrl, this.apiKey, "/v3/checkouts", {
        method: "POST",
        body: JSON.stringify({
          customer: input.externalCustomerId,
          billingTypes: ["CREDIT_CARD", "PIX"],
          chargeTypes: ["RECURRENT"],
          minutesToExpire: 60,
          callback: input.callback,
          items: [
            {
              name: input.planName,
              description: input.planDescription ?? input.planName,
              quantity: 1,
              value: input.value,
            },
          ],
          subscription: {
            cycle: input.cycle,
            nextDueDate: input.nextDueDate,
          },
          externalReference: input.externalReference,
        }),
      });

      if (status >= 200 && status < 300 && body && typeof body === "object" && "id" in body) {
        const checkoutId = String((body as { id: unknown }).id);
        return {
          status: "ok",
          data: {
            externalCheckoutId: checkoutId,
            // Formato documentado em docs.asaas.com/docs/introduction-1: a resposta
            // de criação não traz uma URL pronta, só o id — a página é montada
            // manualmente neste formato.
            checkoutUrl: `https://${this.checkoutHost}/checkoutSession/show?id=${checkoutId}`,
          },
        };
      }

      return {
        status: "failed",
        data: null,
        errorMessage: friendlyErrorFromBody(body, "Não foi possível criar o checkout no Asaas."),
      };
    } catch (error) {
      return { status: "failed", data: null, errorMessage: classifyFetchError(error) };
    }
  }

  async getSubscription(
    externalSubscriptionId: string,
  ): Promise<AsaasProviderResult<AsaasSubscriptionSnapshot>> {
    try {
      const { status, body } = await asaasFetch(
        this.baseUrl,
        this.apiKey,
        `/v3/subscriptions/${externalSubscriptionId}`,
        { method: "GET" },
      );

      if (status === 404) {
        return { status: "not_found", data: null };
      }

      if (status >= 200 && status < 300 && body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        return {
          status: "ok",
          data: {
            externalSubscriptionId: String(b.id),
            status: (b.status as AsaasSubscriptionSnapshot["status"]) ?? "INACTIVE",
            value: typeof b.value === "number" ? b.value : 0,
            cycle: typeof b.cycle === "string" ? b.cycle : "MONTHLY",
            nextDueDate: typeof b.nextDueDate === "string" ? b.nextDueDate : null,
            checkoutSessionId: typeof b.checkoutSession === "string" ? b.checkoutSession : null,
            deleted: Boolean(b.deleted),
          },
        };
      }

      return {
        status: "failed",
        data: null,
        errorMessage: friendlyErrorFromBody(body, "Não foi possível consultar a assinatura no Asaas."),
      };
    } catch (error) {
      return { status: "failed", data: null, errorMessage: classifyFetchError(error) };
    }
  }
}

function classifyFetchError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "Tempo limite ao falar com o Asaas. Tente novamente em alguns instantes.";
  }
  logger.error("Falha de rede ao chamar a API do Asaas", {
    error: error instanceof Error ? error.message : String(error),
  });
  return "Não foi possível falar com o Asaas agora. Tente novamente em alguns instantes.";
}

let cachedProvider: AsaasProvider | null = null;

/** Fábrica cacheada, no mesmo padrão de `getAIProvider()` (Fase 5). */
export function getAsaasProvider(): AsaasProvider {
  if (cachedProvider) return cachedProvider;

  const env = getServerEnv();
  if (!isAsaasConfigured(env)) {
    cachedProvider = new NotConfiguredAsaasProvider();
    return cachedProvider;
  }

  const checkoutHost = env.ASAAS_ENVIRONMENT === "production" ? "asaas.com" : "sandbox.asaas.com";
  cachedProvider = new AsaasProviderImpl(env.ASAAS_API_BASE_URL!, env.ASAAS_API_KEY!, checkoutHost);
  return cachedProvider;
}
