import "server-only";

import { logger } from "@/lib/logger/logger";

/**
 * Cliente HTTP para a API de cobranças da Asaas (v3), usado pela aba
 * "Contratos" (Fase 9 — ver docs/DECISIONS.md). Diferente do antigo
 * `AsaasProvider` de assinatura/checkout (removido): aqui cada chamada
 * usa a chave e o ambiente da PRÓPRIA organização (nunca uma chave
 * global), resolvidos por quem chama antes de instanciar este cliente.
 *
 * Autenticação: header `access_token` com a API key (mesmo padrão já
 * confirmado contra a documentação oficial na implementação anterior).
 * Sem SDK oficial maduro para Node — `fetch` cru.
 */

const SANDBOX_BASE_URL = "https://api-sandbox.asaas.com/v3";
const PRODUCTION_BASE_URL = "https://api.asaas.com/v3";
const REQUEST_TIMEOUT_MS = 15_000;

export function asaasBaseUrlFor(environment: "sandbox" | "production"): string {
  return environment === "production" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
}

export class AsaasChargesClientError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "AsaasChargesClientError";
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
        // Nunca logar este header — é a credencial da conta Asaas da organização.
        access_token: apiKey,
        ...init.headers,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    return { status: response.status, body };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AsaasChargesClientError("A Asaas não respondeu a tempo.");
    }
    throw new AsaasChargesClientError("Falha de rede ao chamar a Asaas.");
  } finally {
    clearTimeout(timeout);
  }
}

function asaasErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "errors" in body) {
    const errors = (body as { errors?: Array<{ description?: string }> }).errors;
    const first = errors?.[0]?.description;
    if (first) return first;
  }
  return fallback;
}

export interface FindOrCreateCustomerInput {
  name: string;
  /** Apenas dígitos (CPF ou CNPJ). */
  cpfCnpj: string;
  email?: string | null;
  phone?: string | null;
  /** `company_id` interno — persistido no Asaas como referência cruzada. */
  externalReference: string;
}

/**
 * Procura um customer já existente pelo CPF/CNPJ (evita duplicar do
 * lado da Asaas quando o cache local em `contract_asaas_customers`
 * ainda não tem a linha — ex.: criada por outra sessão) antes de criar
 * um novo.
 */
export async function findOrCreateAsaasCustomer(
  baseUrl: string,
  apiKey: string,
  input: FindOrCreateCustomerInput,
): Promise<string> {
  const search = await asaasFetch(
    baseUrl,
    apiKey,
    `/customers?cpfCnpj=${encodeURIComponent(input.cpfCnpj)}`,
    { method: "GET" },
  );

  if (search.status === 200) {
    const data = (search.body as { data?: Array<{ id: string }> })?.data ?? [];
    if (data.length > 0) return data[0].id;
  }

  const created = await asaasFetch(baseUrl, apiKey, "/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.cpfCnpj,
      email: input.email || undefined,
      phone: input.phone || undefined,
      externalReference: input.externalReference,
    }),
  });

  if (created.status !== 200) {
    logger.error("Falha ao criar cliente na Asaas", {
      status: created.status,
      externalReference: input.externalReference,
    });
    throw new AsaasChargesClientError(
      asaasErrorMessage(created.body, "Não foi possível cadastrar o cliente na Asaas."),
      created.status,
    );
  }

  return (created.body as { id: string }).id;
}

export type AsaasBillingType = "BOLETO" | "PIX" | "UNDEFINED";

export interface CreateChargeInput {
  customerId: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description?: string | null;
  externalReference: string;
}

export interface CreatedCharge {
  id: string;
  status: string;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
}

export async function createAsaasCharge(
  baseUrl: string,
  apiKey: string,
  input: CreateChargeInput,
): Promise<CreatedCharge> {
  const result = await asaasFetch(baseUrl, apiKey, "/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: input.description || undefined,
      externalReference: input.externalReference,
    }),
  });

  if (result.status !== 200) {
    logger.error("Falha ao criar cobrança na Asaas", {
      status: result.status,
      externalReference: input.externalReference,
    });
    throw new AsaasChargesClientError(
      asaasErrorMessage(result.body, "Não foi possível criar a cobrança na Asaas."),
      result.status,
    );
  }

  const body = result.body as {
    id: string;
    status: string;
    invoiceUrl: string | null;
    bankSlipUrl: string | null;
  };

  return {
    id: body.id,
    status: body.status,
    invoiceUrl: body.invoiceUrl ?? null,
    bankSlipUrl: body.bankSlipUrl ?? null,
  };
}

export interface AsaasPixQrCode {
  encodedImage: string | null;
  payload: string | null;
}

/** Só existe payload de PIX depois que a cobrança foi criada com billingType PIX. */
export async function getAsaasPixQrCode(
  baseUrl: string,
  apiKey: string,
  chargeId: string,
): Promise<AsaasPixQrCode> {
  const result = await asaasFetch(baseUrl, apiKey, `/payments/${chargeId}/pixQrCode`, {
    method: "GET",
  });

  if (result.status !== 200) {
    return { encodedImage: null, payload: null };
  }

  const body = result.body as { encodedImage?: string; payload?: string };
  return { encodedImage: body.encodedImage ?? null, payload: body.payload ?? null };
}

export interface AsaasChargeStatus {
  status: string;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
}

export async function getAsaasChargeStatus(
  baseUrl: string,
  apiKey: string,
  chargeId: string,
): Promise<AsaasChargeStatus> {
  const result = await asaasFetch(baseUrl, apiKey, `/payments/${chargeId}`, { method: "GET" });

  if (result.status !== 200) {
    logger.error("Falha ao consultar status da cobrança na Asaas", {
      status: result.status,
      chargeId,
    });
    throw new AsaasChargesClientError(
      asaasErrorMessage(result.body, "Não foi possível consultar a cobrança na Asaas."),
      result.status,
    );
  }

  const body = result.body as { status: string; invoiceUrl: string | null; bankSlipUrl: string | null };
  return { status: body.status, invoiceUrl: body.invoiceUrl ?? null, bankSlipUrl: body.bankSlipUrl ?? null };
}
