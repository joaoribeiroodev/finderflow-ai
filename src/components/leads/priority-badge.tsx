import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/database";

type Priority = Database["public"]["Enums"]["lead_priority"];

const PRIORITY_CONFIG: Record<Priority, { label: string; variant: "default" | "warning" | "danger" }> = {
  low: { label: "Baixa", variant: "default" },
  medium: { label: "Média", variant: "warning" },
  high: { label: "Alta", variant: "danger" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = PRIORITY_CONFIG[priority];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
