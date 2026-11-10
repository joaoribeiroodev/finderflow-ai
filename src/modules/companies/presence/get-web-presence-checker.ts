import "server-only";

import { getServerEnv } from "@/lib/env/env.server";

import { BraveWebPresenceChecker } from "./brave-web-presence-checker";
import { DomainProbeWebPresenceChecker } from "./domain-probe-web-presence-checker";
import type { WebPresenceChecker } from "./web-presence-checker";

/**
 * `DomainProbeWebPresenceChecker` é o padrão: não exige nenhuma
 * variável de ambiente, chave de API ou cartão de crédito (decisão do
 * usuário, 2026-11-05 — ver docs/DECISIONS.md). `BraveWebPresenceChecker`
 * fica disponível como upgrade opcional só para quem configurar
 * `BRAVE_SEARCH_API_KEY` por conta própria — tem melhor recall (busca
 * de verdade) mas a Brave hoje exige cartão no cadastro mesmo para o
 * nível gratuito, por isso não é mais o padrão.
 *
 * Nunca retorna `null`: sempre há, no mínimo, o verificador por
 * domínio — mantido `| null` no tipo de retorno só por compatibilidade
 * com quem já chama esta função esperando essa possibilidade.
 */
export function getWebPresenceChecker(): WebPresenceChecker | null {
  const env = getServerEnv();
  if (env.BRAVE_SEARCH_API_KEY) return new BraveWebPresenceChecker(env.BRAVE_SEARCH_API_KEY);
  return new DomainProbeWebPresenceChecker();
}

/**
 * A verificação em lote só é liberada quando o verificador não consome
 * cota de terceiros — ou seja, quando é o verificador por domínio.
 */
export function isBulkPresenceCheckAllowed(): boolean {
  return !getServerEnv().BRAVE_SEARCH_API_KEY;
}
