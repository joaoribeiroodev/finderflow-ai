import { Badge } from "@/components/ui/badge";
import { PROPOSAL_STATUS_LABELS, type ProposalStatus } from "@/lib/validation/proposals";

const STATUS_VARIANT: Record<ProposalStatus, "default" | "success" | "warning" | "danger" | "outline"> = {
  draft: "outline",
  sent: "warning",
  accepted: "success",
  rejected: "danger",
  expired: "danger",
};

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{PROPOSAL_STATUS_LABELS[status]}</Badge>;
}
