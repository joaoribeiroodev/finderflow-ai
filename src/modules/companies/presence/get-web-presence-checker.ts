import "server-only";

import { getServerEnv } from "@/lib/env/env.server";

import { BraveWebPresenceChecker } from "./brave-web-presence-checker";
import type { WebPresenceChecker } from "./web-presence-checker";

/** `null` quando `BRAVE_SEARCH_API_KEY` não está configurada — nunca lança, quem chama decide como degradar. */
export function getWebPresenceChecker(): WebPresenceChecker | null {
  const env = getServerEnv();
  if (!env.BRAVE_SEARCH_API_KEY) return null;
  return new BraveWebPresenceChecker(env.BRAVE_SEARCH_API_KEY);
}
