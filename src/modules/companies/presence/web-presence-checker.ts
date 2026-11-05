import "server-only";

/**
 * Contrato para verificar se uma empresa tem (ou não) um site próprio —
 * o sinal central do FinderFlow AI: o produto existe para encontrar
 * clientes potenciais de serviços digitais, e "não tem site" é
 * literalmente o motivo de contato, não um detalhe secundário.
 *
 * A base de CNPJ da Receita Federal (ver `providers/minha-receita-provider.ts`)
 * não tem campo de site — ela não poderia ter: não é função da Receita
 * saber isso. Confirmar presença/ausência de site exige olhar a web, o
 * que foi pedido originalmente como "Playwright + scraping". Decidimos
 * não fazer isso contra resultados de busca do Google ou do Google
 * Maps (violaria os Termos de Uso de ambos — ver docs/DECISIONS.md).
 *
 * Implementação padrão hoje: `DomainProbeWebPresenceChecker` — gera
 * domínios candidatos a partir do nome da empresa e visita cada um
 * diretamente (sem consultar nenhum motor de busca de terceiro), 100%
 * grátis e sem exigir nenhuma chave de API ou cartão de crédito.
 * `BraveWebPresenceChecker` (API de busca paga, com uso comercial
 * explicitamente permitido) continua disponível como upgrade opcional
 * de recall para quem configurar `BRAVE_SEARCH_API_KEY`.
 *
 * Não é 100% preciso (é um indício, não uma certeza — ver
 * `BraveWebPresenceChecker`), por isso a UI mostra "sem site
 * identificado", nunca "não tem site".
 */

export interface WebPresenceQuery {
  companyName: string;
  city?: string;
  state?: string;
}

export interface WebPresenceResult {
  hasWebsite: boolean;
  /** Preenchido só quando `hasWebsite` é `true` e houve um candidato razoavelmente confiável. */
  websiteUrl?: string;
  checkedVia: string;
  checkedAt: string;
}

export interface WebPresenceChecker {
  readonly name: string;
  check(query: WebPresenceQuery): Promise<WebPresenceResult>;
}

export class WebPresenceCheckerNotConfiguredError extends Error {
  constructor() {
    super(
      "A verificação de presença digital ainda não está configurada (defina BRAVE_SEARCH_API_KEY). Sem ela, não é possível identificar automaticamente quais empresas não têm site.",
    );
    this.name = "WebPresenceCheckerNotConfiguredError";
  }
}
