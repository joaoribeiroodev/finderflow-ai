/**
 * Domínios que nunca representam o site próprio de uma empresa — redes
 * sociais, marketplaces, listas/diretórios de CNPJ, mapas e agregadores.
 * Usado por `BraveWebPresenceChecker` para não confundir "a empresa tem
 * uma página no Instagram" ou "a empresa aparece num diretório de CNPJ"
 * com "a empresa tem site próprio".
 *
 * Lista deliberadamente parcial (cobre os casos mais comuns no Brasil) —
 * expandir é seguro e não exige nenhuma outra mudança de código.
 */
export const NON_OWNED_DOMAINS = new Set<string>([
  // Redes sociais / mensageria
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
  "whatsapp.com",
  "wa.me",
  "pinterest.com",
  // Mapas/busca
  "google.com",
  "maps.google.com",
  "bing.com",
  "yahoo.com",
  // Diretórios e dados de CNPJ/empresas
  "guiamais.com.br",
  "telelistas.net",
  "apontador.com.br",
  "solutudo.com.br",
  "econodata.com.br",
  "cnpj.biz",
  "cnpja.com",
  "consultasocio.com",
  "cadastrocompleto.com.br",
  "listanacional.com.br",
  "empresascnpj.com",
  "opencorporates.com",
  "minhareceita.org",
  "casadosdados.com.br",
  "receitaws.com.br",
  "cnpj.rocks",
  "cnpja.com.br",
  // Marketplaces / agregadores de avaliação
  "mercadolivre.com.br",
  "ifood.com.br",
  "booking.com",
  "tripadvisor.com",
  "tripadvisor.com.br",
  "yelp.com",
  "foursquare.com",
  // Notícias/portais genéricos (nunca o site da empresa buscada)
  "uol.com.br",
  "terra.com.br",
  "globo.com",
  "g1.globo.com",
  // Governo (perfil cadastral, não o site da empresa)
  "gov.br",
  "receita.economia.gov.br",
]);

function extractRegistrableDomain(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  // Trata sufixos compostos comuns no Brasil (.com.br, .org.br, etc.).
  const COMPOUND_SUFFIXES = new Set(["com.br", "org.br", "net.br", "gov.br", "edu.br", "co.uk", "com.au"]);
  const lastTwo = parts.slice(-2).join(".");
  if (COMPOUND_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

export function isNonOwnedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return NON_OWNED_DOMAINS.has(extractRegistrableDomain(hostname));
  } catch {
    return true; // URL ilegível não pode ser tratada como site próprio confiável.
  }
}

export { extractRegistrableDomain };
