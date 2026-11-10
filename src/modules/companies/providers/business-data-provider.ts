import "server-only";

import { getServerEnv } from "@/lib/env/env.server";

import { CachedBusinessDataProvider, structuredSearchKeyParts } from "./cached-provider";
import { MinhaReceitaProvider } from "./minha-receita-provider";
import { SupabaseProviderCacheStore } from "./provider-cache-store";

/**
 * Contrato `BusinessDataProvider` (Fase 3, item 3 do prompt mestre):
 * interface comum para qualquer fonte externa de empresas (Google
 * Places, bases de dados comerciais, etc.), para que o resto do app
 * (UI de busca, deduplicação, conversão em lead) nunca dependa de um
 * provedor específico.
 *
 * **Primeiro adaptador real integrado**: `MinhaReceitaProvider`
 * (`minha-receita-provider.ts`), que busca na base pública de CNPJ da
 * Receita Federal via a API comunitária/open-source Minha Receita
 * (minhareceita.org). O processo de verificação exigido pelo prompt
 * mestre ("verificar política de uso, custos, atribuição, cache e
 * retenção antes de integrar") está registrado em `docs/DECISIONS.md`
 * — resumo: dado é público/oficial do governo, código do Minha Receita
 * é MIT, não há cobrança, mas também não há SLA formal (é um servidor
 * comunitário) e o acesso direto da Receita Federal aos arquivos brutos
 * está atrás de proteção anti-bot/CAPTCHA (confirmado ao vivo), o que
 * motivou usar o Minha Receita em vez de tentar contornar isso.
 *
 * **Limitação conhecida e deliberada**: este provedor cobre descoberta
 * por segmento (CNAE) + localização, usando dados cadastrais oficiais
 * (razão social, endereço, CNAE, situação cadastral, telefone/e-mail
 * quando cadastrados). Ele NÃO resolve site institucional, redes
 * sociais ou quem é o decisor — e o contato cadastrado na Receita
 * frequentemente é do contador, não da empresa. Enriquecimento via
 * scraping (Playwright) do site da própria empresa, feito depois que
 * ela já foi encontrada, é um passo futuro distinto, com suas próprias
 * considerações legais (nunca contra o Google/SERP) — ver
 * docs/DECISIONS.md.
 */

export interface BusinessSearchQuery {
  query: string;
  segment?: string;
  state?: string;
  city?: string;
  /**
   * Códigos de CNAE Fiscal já resolvidos (ver `cnae-resolver.ts`) para
   * usar como filtro. Resolver o segmento em texto livre para CNAE é
   * responsabilidade de quem chama o provedor, não do provedor — assim
   * nenhum provedor específico (nem a IA usada para resolver) vira uma
   * dependência obrigatória do contrato.
   */
  cnaeCodes?: string[];
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
  /**
   * Presente quando a página veio do cache (`cached-provider.ts`) em vez
   * de uma chamada nova ao provedor. `stale` = o provedor falhou agora e
   * esta é a última resposta conhecida — a tela deve avisar o usuário.
   */
  cache?: { state: "fresh" | "stale"; fetchedAt: string };
  /** O provedor falhou no meio da paginação: há resultados, mas a lista pode estar incompleta. */
  partial?: boolean;
}

export interface BusinessDataProvider {
  /** Identificador estável do provedor (ex.: `"google_places"`), usado em `company_source_refs.provider`. */
  readonly name: string;
  search(query: BusinessSearchQuery): Promise<BusinessSearchPage>;
  /**
   * Consulta direta por CNPJ específico (diferente de `search`, que é
   * por filtros/segmento). Opcional no contrato: nem todo provedor
   * oferece uma consulta direta por identificador (um provedor
   * baseado em busca textual tipo Google Places, por exemplo, não
   * teria isso). `null` quando o CNPJ é válido mas não foi encontrado
   * na base do provedor — nunca lança nesse caso.
   */
  getByCnpj?(cnpj: string): Promise<BusinessSearchResultItem | null>;
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super(
      "Nenhum provedor de busca de empresas está configurado. O cadastro manual e a importação por CSV já estão disponíveis em /companies.",
    );
    this.name = "ProviderNotConfiguredError";
  }
}

/**
 * O provedor externo falhou (fora do ar, lento ou limitando requisições).
 * A mensagem já é escrita para o usuário final — as actions podem
 * repassá-la como está.
 */
export class BusinessProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessProviderUnavailableError";
  }
}

/** Erro lançado quando a busca não tem filtro suficiente para o provedor atual (nem UF, nem CNAE resolvido). */
export class BusinessSearchQueryTooBroadError extends Error {
  constructor() {
    super(
      "Para buscar automaticamente, informe pelo menos um segmento reconhecido (ex.: \"restaurantes\", \"clínicas odontológicas\") ou um estado (UF).",
    );
    this.name = "BusinessSearchQueryTooBroadError";
  }
}

/** Usado quando nenhum provedor está configurado (`BUSINESS_PROVIDER` ausente/desconhecido). */
export class NotConfiguredProvider implements BusinessDataProvider {
  readonly name = "none";
  async search(): Promise<BusinessSearchPage> {
    throw new ProviderNotConfiguredError();
  }
}

/**
 * Lê `BUSINESS_PROVIDER` (ver `src/lib/env/env.server.ts`) e devolve o
 * adaptador correspondente. `"minha_receita"` não exige chave de API —
 * é um serviço público gratuito — mas pode ser desligado (variável
 * ausente ou `none`) caso o operador prefira não depender dele.
 * `BUSINESS_PROVIDER_BASE_URL` permite apontar para uma instância
 * auto-hospedada do mesmo projeto (open-source, MIT) no lugar do
 * servidor comunitário público, sem mudar nenhum outro código — ver
 * docs/DECISIONS.md para quando isso passa a valer a pena.
 */
export function getBusinessDataProvider(): BusinessDataProvider {
  const env = getServerEnv();

  if (env.BUSINESS_PROVIDER === "minha_receita") {
    // O Minha Receita só filtra por CNAE/UF/cidade — o texto livre da
    // busca não muda a resposta, então não entra na chave do cache.
    return new CachedBusinessDataProvider(
      new MinhaReceitaProvider(env.BUSINESS_PROVIDER_BASE_URL ?? "https://minhareceita.org"),
      new SupabaseProviderCacheStore(),
      { searchKeyParts: structuredSearchKeyParts },
    );
  }

  return new NotConfiguredProvider();
}
