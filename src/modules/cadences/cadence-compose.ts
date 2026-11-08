/**
 * Módulo 7 — Cadências e Follow-up.
 *
 * Funções puras e testáveis separadas do acesso a dados (mesmo padrão
 * dos Módulos 3/4/5/6) — aqui, a substituição de placeholders no
 * template (escrito por um humano ao criar a etapa, nunca por IA) e o
 * cálculo de quando cada etapa deve rodar.
 */

export interface CadenceTemplateVars {
  contactName?: string | null;
  companyName?: string | null;
  senderName?: string | null;
}

const PLACEHOLDER_KEYS: Record<keyof CadenceTemplateVars, string> = {
  contactName: "contact_name",
  companyName: "company_name",
  senderName: "sender_name",
};

/**
 * Substitui `{{chave}}` pelo valor real. Nunca inventa dado: quando o
 * valor não está disponível (contato sem nome, por exemplo), o
 * placeholder é removido e não substituído por um texto genérico tipo
 * "cliente" — a organização escreveu o template sabendo que isso pode
 * faltar.
 */
export function renderCadenceTemplate(template: string, vars: CadenceTemplateVars): string {
  let result = template;
  for (const [key, placeholder] of Object.entries(PLACEHOLDER_KEYS) as [keyof CadenceTemplateVars, string][]) {
    const value = vars[key];
    const pattern = new RegExp(`\\{\\{\\s*${placeholder}\\s*\\}\\}`, "g");
    result = result.replace(pattern, value?.trim() ? value.trim() : "");
  }
  // Colapsa espaços duplos deixados por um placeholder vazio removido
  // (ex.: "Olá {{contact_name}}," sem nome vira "Olá ," — ainda assim
  // preferível a inventar um nome; aqui só limpamos o espaço extra).
  return result.replace(/[ \t]{2,}/g, " ").trim();
}

export function renderCadenceStepBody(bodyTemplate: string, unsubscribeText: string, vars: CadenceTemplateVars): string {
  const rendered = renderCadenceTemplate(bodyTemplate, vars);
  return `${rendered}\n\n---\n${unsubscribeText.trim()}`;
}

/**
 * Data/hora em que uma etapa deve rodar: sempre `startedAt + dayOffset`
 * dias — nunca relativo ao envio da etapa anterior (evita drift
 * acumulado se um envio atrasar por retry/fila).
 */
export function computeStepRunAt(startedAt: Date, dayOffsetDays: number): Date {
  const result = new Date(startedAt);
  result.setDate(result.getDate() + dayOffsetDays);
  return result;
}

export type CadenceStepDecision =
  | { action: "send" }
  | { action: "stop"; reason: "lead_closed" | "suppressed" }
  | { action: "skip"; reason: "no_recipient_email" };

export interface CadenceStepDecisionInput {
  leadStatus: "open" | "won" | "lost";
  recipientEmail: string | null;
  isSuppressed: boolean;
}

/**
 * Condições de parada automática (risco #2/#3 da auditoria: nunca
 * continuar contatando quem não deve mais ser contatado). Lead
 * ganho/perdido ou contato suprimido PARA a cadência inteira (não só
 * pula a etapa) — continuar tentando a próxima etapa não faz sentido
 * nesses dois casos. Falta de e-mail de destino só pula esta etapa
 * (pode ter sido um erro temporário de cadastro).
 */
export function decideCadenceStep(input: CadenceStepDecisionInput): CadenceStepDecision {
  if (input.leadStatus !== "open") return { action: "stop", reason: "lead_closed" };
  if (input.isSuppressed) return { action: "stop", reason: "suppressed" };
  if (!input.recipientEmail || !input.recipientEmail.includes("@")) {
    return { action: "skip", reason: "no_recipient_email" };
  }
  return { action: "send" };
}
