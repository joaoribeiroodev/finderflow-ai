import { Trash2 } from "lucide-react";

import { formatBRL } from "@/lib/utils/format";
import { removeProposalItemAction } from "@/modules/proposals/actions";
import type { ProposalItemRow } from "@/modules/proposals/proposals.service";

export function ProposalItemRowView({
  item,
  proposalId,
  editable,
}: {
  item: ProposalItemRow;
  proposalId: string;
  editable: boolean;
}) {
  return (
    <tr className="border-b border-[var(--ff-border-subtle)] last:border-b-0">
      <td className="py-2.5 text-sm text-[var(--ff-text-primary)]">{item.description}</td>
      <td className="ff-tabular-nums py-2.5 text-right text-sm text-[var(--ff-text-secondary)]">
        {Number(item.quantity)}
      </td>
      <td className="ff-tabular-nums py-2.5 text-right text-sm text-[var(--ff-text-secondary)]">
        {formatBRL(Number(item.unit_price))}
      </td>
      <td className="ff-tabular-nums py-2.5 text-right text-sm font-medium text-[var(--ff-text-primary)]">
        {formatBRL(Number(item.total))}
      </td>
      <td className="py-2.5 text-right">
        {editable ? (
          <form action={removeProposalItemAction}>
            <input type="hidden" name="proposalId" value={proposalId} />
            <input type="hidden" name="itemId" value={item.id} />
            <button
              type="submit"
              aria-label={`Remover ${item.description}`}
              className="text-[var(--ff-text-muted)] hover:text-[var(--ff-danger)]"
            >
              <Trash2 className="size-4" />
            </button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}
