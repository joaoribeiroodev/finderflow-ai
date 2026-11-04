import type { ReactNode } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

/** Wrapper de card para gráficos/listas analíticas (funil, atividade, etc.). */
export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      {children}
    </Card>
  );
}

/**
 * Barra de funil (uma etapa do pipeline): nome, barra proporcional ao
 * máximo da série e contagem. `prefers-reduced-motion` é respeitado pela
 * regra global em globals.css (sem animação custom aqui).
 */
export function FunnelRow({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color?: string;
}) {
  const widthPct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0;
  return (
    <div className="my-3 grid grid-cols-[minmax(0,105px)_1fr_auto] items-center gap-2.5 text-xs">
      <span className="truncate text-[var(--ff-text-secondary)]">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#312644]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${widthPct}%`,
            background: color ?? "linear-gradient(90deg, var(--ff-purple-500), var(--ff-magenta))",
          }}
        />
      </div>
      <b className="ff-tabular-nums text-[var(--ff-text-primary)]">{count}</b>
    </div>
  );
}
