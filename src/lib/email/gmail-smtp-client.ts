import "server-only";

import nodemailer from "nodemailer";

/**
 * Envia e-mail via SMTP do Gmail, usando a própria conta Gmail da
 * organização (endereço + senha de app — https://myaccount.google.com/apppasswords,
 * exige verificação em duas etapas ativada na conta). Escolhido em vez de
 * um provedor transacional (Resend/SendGrid) de propósito: o e-mail sai
 * com o remetente real do usuário, o que passa mais credibilidade e cai
 * menos em spam do que um domínio genérico tipo "via resend.dev" — e é
 * gratuito (limite do Gmail: ~500 e-mails/dia numa conta pessoal, bem
 * acima do volume de prospecção manual revisada por humano desta
 * feature).
 */
export interface SendGmailParams {
  gmailAddress: string;
  appPassword: string;
  to: string;
  subject: string;
  text: string;
}

export async function sendGmailMessage(params: SendGmailParams): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: params.gmailAddress,
      pass: params.appPassword,
    },
  });

  await transporter.sendMail({
    from: params.gmailAddress,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
