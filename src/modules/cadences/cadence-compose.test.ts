import { describe, expect, it } from "vitest";

import {
  computeStepRunAt,
  decideCadenceStep,
  renderCadenceStepBody,
  renderCadenceTemplate,
} from "./cadence-compose";

describe("renderCadenceTemplate", () => {
  it("substitui os placeholders conhecidos pelos valores reais", () => {
    const result = renderCadenceTemplate("Olá {{contact_name}}, aqui é {{sender_name}} da {{company_name}}.", {
      contactName: "Maria",
      senderName: "João",
      companyName: "Acme",
    });
    expect(result).toBe("Olá Maria, aqui é João da Acme.");
  });

  it("remove o placeholder sem inventar um valor genérico quando o dado falta", () => {
    const result = renderCadenceTemplate("Olá {{contact_name}},", { contactName: null });
    expect(result).not.toContain("{{contact_name}}");
    expect(result).not.toMatch(/cliente|senhor|prezado/i);
  });

  it("não altera texto sem placeholders", () => {
    expect(renderCadenceTemplate("Mensagem fixa.", {})).toBe("Mensagem fixa.");
  });
});

describe("renderCadenceStepBody", () => {
  it("anexa o texto de descadastro ao final, sempre separado", () => {
    const body = renderCadenceStepBody("Corpo do e-mail.", "Para sair da lista, responda PARAR.", {});
    expect(body).toContain("Corpo do e-mail.");
    expect(body).toContain("Para sair da lista, responda PARAR.");
    expect(body.indexOf("Corpo do e-mail.")).toBeLessThan(body.indexOf("Para sair da lista"));
  });
});

describe("computeStepRunAt", () => {
  it("soma dayOffset dias a partir de startedAt (nunca relativo ao envio anterior)", () => {
    const started = new Date("2026-01-01T10:00:00Z");
    expect(computeStepRunAt(started, 0).toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(computeStepRunAt(started, 3).toISOString().slice(0, 10)).toBe("2026-01-04");
    expect(computeStepRunAt(started, 7).toISOString().slice(0, 10)).toBe("2026-01-08");
  });
});

describe("decideCadenceStep", () => {
  it("para a cadência inteira quando o lead foi ganho ou perdido", () => {
    expect(decideCadenceStep({ leadStatus: "won", recipientEmail: "a@b.com", isSuppressed: false })).toEqual({
      action: "stop",
      reason: "lead_closed",
    });
    expect(decideCadenceStep({ leadStatus: "lost", recipientEmail: "a@b.com", isSuppressed: false })).toEqual({
      action: "stop",
      reason: "lead_closed",
    });
  });

  it("para a cadência inteira quando o contato está suprimido (fail-closed)", () => {
    expect(decideCadenceStep({ leadStatus: "open", recipientEmail: "a@b.com", isSuppressed: true })).toEqual({
      action: "stop",
      reason: "suppressed",
    });
  });

  it("só pula a etapa (não para a cadência) quando falta e-mail de destino", () => {
    expect(decideCadenceStep({ leadStatus: "open", recipientEmail: null, isSuppressed: false })).toEqual({
      action: "skip",
      reason: "no_recipient_email",
    });
  });

  it("permite o envio quando lead está aberto, sem supressão e com e-mail válido", () => {
    expect(decideCadenceStep({ leadStatus: "open", recipientEmail: "a@b.com", isSuppressed: false })).toEqual({
      action: "send",
    });
  });
});
