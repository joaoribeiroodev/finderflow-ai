import { Button } from "@/components/ui/button";
import { PROPOSAL_ALLOWED_TRANSITIONS, PROPOSAL_STATUS_LABELS, type ProposalStatus } from "@/lib/validation/proposals";
import { changeProposalStatusAction } from "@/modules/proposals/actions";

const TRANSITION_VARIANT: Record<ProposalStatus, "primary" | "secondary"> = {
  draft: "secondary",
  sent: "primary",
  accepted: "primary",
  rejected: "secondary",
  expired: "secondary",
};

export function ProposalStatusActions({
  proposalId,
  currentStatus,
}: {
  proposalId: string;
  currentStatus: ProposalStatus;
}) {
  const transitions = PROPOSAL_ALLOWED_TRANSITIONS[currentStatus];
  if (transitions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((next) => (
        <form key={next} action={changeProposalStatusAction}>
          <input type="hidden" name="proposalId" value={proposalId} />
          <input type="hidden" name="currentStatus" value={currentStatus} />
          <input type="hidden" name="newStatus" value={next} />
          <Button type="submit" variant={TRANSITION_VARIANT[next]} size="sm">
            {next === "draft" ? "Reabrir como rascunho" : `Marcar como ${PROPOSAL_STATUS_LABELS[next].toLowerCase()}`}
          </Button>
        </form>
      ))}
    </div>
  );
}
