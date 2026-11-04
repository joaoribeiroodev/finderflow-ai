"use client";

import { useTransition } from "react";
import { Download, FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { generateProposalPdfAction } from "@/modules/proposals/actions";

export function ProposalPdfButton({
  proposalId,
  signedUrl,
}: {
  proposalId: string;
  signedUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        action={(formData) => startTransition(() => generateProposalPdfAction(formData))}
      >
        <input type="hidden" name="proposalId" value={proposalId} />
        <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
          <FileDown className="mr-1.5 size-4" />
          {isPending ? "Gerando..." : signedUrl ? "Gerar novo PDF" : "Gerar PDF"}
        </Button>
      </form>
      {signedUrl ? (
        <a
          href={signedUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--ff-border-subtle)] px-3 text-sm text-[var(--ff-text-primary)] hover:border-[var(--ff-purple-500)]"
        >
          <Download className="size-4" /> Baixar PDF
        </a>
      ) : null}
    </div>
  );
}
