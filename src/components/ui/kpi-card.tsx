import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export interface KpiCardProps {
  label: string;
  /** Valor já formatado (ex.: "R$ 28.400", "1.284"). */
  value: string;
  icon: LucideIcon;
  /**
   * Variação textual (ex.: "+12,4% vs. período anterior"). Omitir quando
   * não há dado histórico real para comparar — nunca inventar uma
   * tendência (regra geral do projeto: nada de dado fabricado).
   */
  trend?: { label: string; direction: "up" | "down" | "flat" };
  className?: string;
}

const TREND_COLOR: Record<NonNullable<KpiCardProps["trend"]>["direction"], string> = {
  up: "text-[var(--ff-success)]",
  down: "text-[var(--ff-danger)]",
  flat: "text-[var(--ff-text-muted)]",
};

const TREND_ARROW: Record<NonNullable<KpiCardProps["trend"]>["direction"], string> = {
  up: "↗",
  down: "↘",
  flat: "→",
};

export function KpiCard({ label, value, icon: Icon, trend, className }: KpiCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--ff-text-secondary)]">{label}</span>
        <span className="flex size-9 items-center justify-center rounded-[var(--ff-radius-md)] bg-[rgba(117,65,200,0.17)] text-[var(--ff-violet-glow)]">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <div className="ff-tabular-nums mt-1.5 text-[26px] font-bold tracking-tight text-[var(--ff-text-primary)]">
        {value}
      </div>
      {trend ? (
        <div className={cn("text-xs", TREND_COLOR[trend.direction])}>
          {TREND_ARROW[trend.direction]} {trend.label}
        </div>
      ) : null}
    </Card>
  );
}
