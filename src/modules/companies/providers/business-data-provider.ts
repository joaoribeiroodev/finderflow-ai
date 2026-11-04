import "server-only";

/**
 * Contrato `BusinessDataProvider` (Fase 3, item 3 do prompt mestre):
 * interface comum para qualquer fonte externa de empresas (Google
 * Places, bases de dados comerciais, etc.), para que o resto do app
 * (UI de busca, deduplicação, conversão em lead) nunca dependa de um
 * provedor específico.
 *
 * **Nenhum adaptador real está integrado nesta fase.** Qual provedor
 * usar (cobertura no Brasil, preço, quotas, licença de uso comercial,
 * política de cache/atribuição, SLA) é a decisão pendente #1 em
 * docs/DECISIONS.md — o prompt mestre exige resolver isso *antes* de
 * integrar ("Integrar o primeiro provedor real somente após verificar
 * política de uso, custos, atribuição, cache e retenção"). Implementar
 * um adaptador "de exemplo" aqui, sem esse processo, seria fingir uma
 * integração que não existe. Em vez disso, o contrato está pronto e a UI
 * de prospecção (`/prospecting`) expõe esse estado honestamente.
 */

export interface BusinessSearchQuery {
  query: string;
  segment?: string;
  state?: string;
  city?: string;
  /** Token de paginação opaco devolvido por uma página anterior do mesmo provedor. */
  pageToken?: string;
}

export interface BusinessSearchResultItem {
  externalId: string;
  provider: string;
  name: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  /** Dados adicionais específicos do provedor, exibidos como estão (não normalizados). */
  displayData: Record<string, unknown>;
  /** Metadados de atribuição exigidos pelos termos de uso do provedor (ex.: "Dados: Google"). */
  attribution: Record<string, unknown>;
  fetchedAt: string;
  /** Quando os dados deixam de poder ser exibidos/armazenados pela política do provedor. */
  expiresAt?: string;
}

export interface BusinessSearchPage {
  items: BusinessSearchResultItem[];
  nextPageToken?: string;
  totalEstimate?: number;
}

export interface BusinessDataProvider {
  /** Identificador estável do provedor (ex.: `"google_places"`), usado em `company_source_refs.provider`. */
  readonly name: string;
  search(query: BusinessSearchQuery): Promise<BusinessSearchPage>;
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super(
      "Nenhum provedor de busca de empresas está configurado. O cadastro manual e a importação por CSV já estão disponíveis em /companies.",
    );
    this.name = "ProviderNotConfiguredError";
  }
}

/** Usado enquanto nenhum provedor real for integrado (ver docs/DECISIONS.md, decisão pendente #1). */
export class NotConfiguredProvider implements BusinessDataProvider {
  readonly name = "none";
  async search(): Promise<BusinessSearchPage> {
    throw new ProviderNotConfiguredError();
  }
}

export function getBusinessDataProvider(): BusinessDataProvider {
  return new NotConfiguredProvider();
}
