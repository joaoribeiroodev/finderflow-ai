import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";

import { logger } from "@/lib/logger/logger";
import { formatBRL, formatCalendarDate, formatDate } from "@/lib/utils/format";
import type { ProposalDetail } from "./proposals.service";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Gera o PDF de uma proposta a partir dos dados reais já persistidos
 * (nenhum valor é recalculado/inventado aqui — a soma dos itens já vem
 * consistente do `total_amount` mantido por trigger no banco, ver
 * migration `fase7_services_proposals`). `pdfkit` é puro JS (sem
 * dependências nativas como Chromium/Puppeteer), o que o torna seguro
 * para rodar em ambiente serverless sem passos extras de build.
 */
function buildProposalPdfBuffer(
  proposal: ProposalDetail,
  organizationName: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Proposta comercial", { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#555").text(`${organizationName}`);
    doc.text(`Proposta ${proposal.proposal_number}`);
    doc.text(`Emitida em ${formatDate(proposal.created_at)}`);
    if (proposal.valid_until) {
      // valid_until é uma data-calendário pura (coluna `date`, sem hora) —
      // ver comentário em formatCalendarDate (lib/utils/format.ts) sobre por
      // que isso nunca deve passar por new Date()/timezone.
      doc.text(`Válida até ${formatCalendarDate(proposal.valid_until)}`);
    }
    if (proposal.lead?.company?.name) {
      doc.text(`Para: ${proposal.lead.company.name}`);
    }
    doc.fillColor("#000");
    doc.moveDown(1);

    doc.fontSize(12).text("Itens", { underline: true });
    doc.moveDown(0.5);

    const colX = { description: 50, qty: 320, unit: 380, total: 470 };
    doc.fontSize(9).fillColor("#555");
    doc.text("Descrição", colX.description, doc.y, { continued: false });
    doc.text("Qtd.", colX.qty, doc.y - doc.currentLineHeight(), { width: 50, align: "right" });
    doc.text("Unitário", colX.unit, doc.y - doc.currentLineHeight(), { width: 80, align: "right" });
    doc.moveDown(0.3);
    doc.fillColor("#000");

    for (const item of proposal.items) {
      const y = doc.y;
      doc.fontSize(10).text(item.description, colX.description, y, { width: 260 });
      doc.text(String(Number(item.quantity)), colX.qty, y, { width: 50, align: "right" });
      doc.text(formatBRL(Number(item.unit_price)), colX.unit, y, { width: 80, align: "right" });
      doc.text(formatBRL(Number(item.total)), colX.total, y, { width: 90, align: "right" });
      doc.moveDown(0.6);
    }

    doc.moveDown(0.5);
    doc.fontSize(12).text(`Total: ${formatBRL(Number(proposal.total_amount))}`, { align: "right" });

    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor("#999")
      .text(
        "Este documento representa uma proposta comercial entre as partes acima. Valores e condições não constituem cobrança do FinderFlow AI.",
        { align: "left" },
      );

    doc.end();
  });
}

const BUCKET = "proposals";

function objectPath(organizationId: string, proposalId: string): string {
  return `${organizationId}/${proposalId}.pdf`;
}

/**
 * Gera o PDF, sobe para o bucket privado `proposals` (path
 * `{organization_id}/{proposal_id}.pdf` — a mesma convenção usada nas
 * policies de storage da migration) e grava `document_path`. Usa o
 * cliente autenticado do usuário (nunca o service role): as policies de
 * storage já exigem `can_edit_org`, então a autorização é a mesma RLS que
 * protege o resto dos dados da proposta.
 */
export async function generateProposalPdf(
  supabase: Supabase,
  organizationId: string,
  organizationName: string,
  proposal: ProposalDetail,
): Promise<string> {
  const buffer = await buildProposalPdfBuffer(proposal, organizationName);
  const path = objectPath(organizationId, proposal.id);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (uploadError) {
    logger.error("Falha ao subir PDF da proposta", {
      error: uploadError.message,
      organizationId,
      proposalId: proposal.id,
    });
    throw new Error("Não foi possível gerar o PDF da proposta.");
  }

  const { error: updateError } = await supabase
    .from("proposals")
    .update({ document_path: path })
    .eq("organization_id", organizationId)
    .eq("id", proposal.id);

  if (updateError) {
    logger.error("Falha ao gravar document_path da proposta", {
      error: updateError.message,
      organizationId,
      proposalId: proposal.id,
    });
    throw new Error("PDF gerado, mas não foi possível registrá-lo na proposta.");
  }

  return path;
}

/** URL assinada de curta duração para download do PDF já gerado. */
export async function getProposalPdfSignedUrl(
  supabase: Supabase,
  documentPath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(documentPath, 60 * 5);

  if (error) {
    logger.error("Falha ao gerar URL assinada do PDF da proposta", { error: error.message, documentPath });
    return null;
  }

  return data.signedUrl;
}
