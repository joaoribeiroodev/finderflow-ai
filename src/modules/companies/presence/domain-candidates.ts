/**
 * Gera domínios candidatos a partir do nome de uma empresa, para o
 * `DomainProbeWebPresenceChecker`. Isto é uma heurística (não uma
 * busca): a partir de "Padaria Bela Vista Ltda" tentamos
 * `padariabelavista.com.br`, `www.padariabelavista.com.br`,
 * `padariabelavista.com` etc. e checamos se algum desses domínios
 * responde como um site real.
 *
 * Isto não é scraping de um motor de busca (Google/Bing) nem de um
 * provedor de mapas (Google Maps) — nenhum conteúdo de terceiro é
 * extraído aqui. É só construir URLs plausíveis e visitá-las
 * diretamente, do mesmo jeito que qualquer navegador faria ao digitar
 * um endereço — por isso não há risco de violar Termos de Uso de
 * nenhuma plataforma (ver docs/DECISIONS.md, decisão sobre scraping
 * do Google Maps/Search).
 *
 * Trade-off aceito conscientemente: tem recall bem mais baixo que uma
 * busca real (só acha o site se o domínio seguir um padrão previsível
 * a partir do nome) — mas é 100% grátis, não depende de nenhuma chave
 * de API nem cartão de crédito, o que a Brave Search API (ver
 * `brave-web-presence-checker.ts`) hoje exige no cadastro.
 */

const LEGAL_SUFFIXES = [
  "ltda",
  "me",
  "eireli",
  "epp",
  "sa",
  "s a",
  "mei",
  "slu",
  "individual",
  "cia",
  "e filhos",
  "e filho",
  "comercio",
  "comercio de",
  "servicos",
  "servicos de",
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Remove sufixos jurídicos (LTDA, ME, EIRELI...) do fim do nome, aplicando repetidamente (ex.: "... Comércio Ltda"). */
function stripLegalSuffixes(normalized: string): string {
  let current = normalized;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of LEGAL_SUFFIXES) {
      const pattern = new RegExp(`\\s${suffix}$`);
      if (pattern.test(current)) {
        current = current.replace(pattern, "").trim();
        changed = true;
      }
    }
  }
  return current;
}

/** Slug sem espaços/hífens, ex.: "padaria bela vista" -> "padariabelavista". */
function toSlug(normalized: string): string {
  return normalized.replace(/\s+/g, "");
}

/** Slug com hífens entre palavras, ex.: "padaria bela vista" -> "padaria-bela-vista". */
function toHyphenSlug(normalized: string): string {
  return normalized.replace(/\s+/g, "-");
}

/**
 * Gera até ~12 domínios candidatos para `companyName`, ordenados do
 * mais provável ao menos provável. Nomes muito curtos (<3 letras após
 * limpeza) ou muito genéricos não geram candidatos confiáveis — nesse
 * caso a lista vem vazia e o checker simplesmente não acha nada
 * (comportamento seguro: nunca inventa um domínio para nome vago
 * demais, como "comercio" sozinho).
 */
export function generateDomainCandidates(companyName: string): string[] {
  const normalized = stripAccents(companyName)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const withoutSuffixes = stripLegalSuffixes(normalized);
  if (withoutSuffixes.length < 3) return [];

  const bases = Array.from(new Set([toSlug(withoutSuffixes), toHyphenSlug(withoutSuffixes)]));

  const candidates: string[] = [];
  for (const base of bases) {
    if (base.length < 3) continue;
    for (const tld of [".com.br", ".com", ".net.br"]) {
      candidates.push(`https://www.${base}${tld}`);
      candidates.push(`https://${base}${tld}`);
    }
  }

  // Remove duplicatas preservando a ordem (prioriza slug sem hífen, que é o padrão mais comum no Brasil).
  return Array.from(new Set(candidates));
}
