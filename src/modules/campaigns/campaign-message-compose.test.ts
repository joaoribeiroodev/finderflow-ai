import { describe, expect, it } from "vitest";

import {
  getCampaignMessageSendBlockReason,
  renderCampaignMessageBody,
  type CampaignMessageGuardInput,
} from "./campaign-message-compose";

function guard(overrides: Partial<CampaignMessageGuardInput> = {}): CampaignMessageGuardInput {
  return {
    messageStatus: "approved",
    recipientEmail: "contato@empresa.com",
    hasUnsubscribeText: true,
    gmailConfigured: true,
    ...overrides,
  };
}

describe("getCampaignMessageSendBlockReason", () => {
  it("permite envio quando tudo está correto", () => {
    expect(getCampaignMessageSendBlockReason(guard())).toBeNull();
  });

  it("bloqueia mensagem ainda não aprovada", () => {
    expect(getCampaignMessageSendBlockReason(guard({ messageStatus: "draft" }))).toMatch(/aprovada/);
  });

  it("bloqueia reenvio de mensagem já enviada", () => {
    expect(getCampaignMessageSendBlockReason(guard({ messageStatus: "sent" }))).toMatch(/já foi enviada/);
  });

  it("bloqueia sem e-mail de destino válido", () => {
    expect(getCampaignMessageSendBlockReason(guard({ recipientEmail: null }))).toMatch(/e-mail de destino/);
    expect(getCampaignMessageSendBlockReason(guard({ recipientEmail: "sem-arroba" }))).toMatch(
      /e-mail de destino/,
    );
  });

  it("bloqueia sem texto de descadastro configurado na organização", () => {
    expect(getCampaignMessageSendBlockReason(guard({ hasUnsubscribeText: false }))).toMatch(
      /descadastro/,
    );
  });

  it("bloqueia sem Gmail configurado", () => {
    expect(getCampaignMessageSendBlockReason(guard({ gmailConfigured: false }))).toMatch(/Gmail/);
  });

  it("checa descadastro antes de checar Gmail (prioridade de bloqueio)", () => {
    expect(
      getCampaignMessageSendBlockReason(guard({ hasUnsubscribeText: false, gmailConfigured: false })),
    ).toMatch(/descadastro/);
  });
});

describe("renderCampaignMessageBody", () => {
  it("anexa o texto de descadastro como parágrafo separado ao final", () => {
    const rendered = renderCampaignMessageBody(
      "Oi, tudo bem? Vi que vocês ainda não têm site.",
      "Para não receber mais e-mails, responda com 'remover'.",
    );

    expect(rendered).toBe(
      "Oi, tudo bem? Vi que vocês ainda não têm site.\n\n---\nPara não receber mais e-mails, responda com 'remover'.",
    );
  });

  it("remove espaços em branco nas pontas de ambos os textos", () => {
    const rendered = renderCampaignMessageBody("  corpo  \n", "  descadastro  \n");
    expect(rendered).toBe("corpo\n\n---\ndescadastro");
  });
});
