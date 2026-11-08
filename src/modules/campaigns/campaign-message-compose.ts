/**
 * Módulo 6 — Campanhas de Vendas.
 *
 * Funções puras e testáveis separadas do acesso a dados (mesmo padrão
 * dos Módulos 3/4/5) — aqui, a composição do corpo final de uma mensagem
 * de campanha e os porquês de uma mensagem não poder ser enviada ainda.
 */

export interface CampaignMessageGuardInput {
  messageStatus: "draft" | "approved" | "sent" | "failed";
  recipientEmail: string | null;
  hasUnsubscribeText: boolean;
  gmailConfigured: boolean;
}

/**
 * Motivo (ou `null` se puder enviar) pelo qual uma mensagem de campanha
 * ainda não pode ser enviada. Centraliza as 4 checagens que, juntas,
 * cumprem a seção 6 da auditoria (texto de descadastro obrigatório) e o
 * risco #2 (nunca contatar sem canal configurado nem revisão humana
 * prévia — `status==='approved'` é o gate de "quem aprovou").
 */
export function getCampaignMessageSendBlockReason(input: CampaignMessageGuardInput): string | null {
  if (input.messageStatus === "sent") return "Esta mensagem já foi enviada.";
  if (input.messageStatus !== "approved") {
    return "A mensagem precisa ser aprovada por um humano antes de ser enviada.";
  }
  if (!input.recipientEmail || !input.recipientEmail.includes("@")) {
    return "Nenhum e-mail de destino válido para esta empresa.";
  }
  if (!input.hasUnsubscribeText) {
    return "Configure o texto de descadastro da organização (Configurações → Perfil) antes de enviar campanhas.";
  }
  if (!input.gmailConfigured) {
    return "Configure sua conta Gmail em Configurações → Integrações antes de enviar campanhas.";
  }
  return null;
}

/**
 * Corpo final enviado = corpo revisado por humano + o texto de
 * descadastro da própria organização, sempre como um parágrafo
 * claramente separado ao final. O texto de descadastro NUNCA é gerado
 * pela IA nem tem um padrão da plataforma (ver migration
 * module6_campaigns) — é sempre literalmente o que a organização
 * escreveu em seu perfil.
 */
export function renderCampaignMessageBody(body: string, unsubscribeText: string): string {
  return `${body.trim()}\n\n---\n${unsubscribeText.trim()}`;
}
