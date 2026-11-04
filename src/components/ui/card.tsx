import { type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Card base do design system (docs/06-design-system.md §6.2/§6.4):
 * gradiente sutil, borda discreta, raio 14–18px, sombra suave. Usado como
 * base por `KpiCard`, `ChartCard` e seções de conteúdo soltas.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--ff-radius-lg)] border border-[var(--ff-border-subtle)]",
        "bg-[linear-gradient(150deg,rgba(30,24,48,0.94),rgba(20,16,33,0.97))]",
        "[box-shadow:var(--ff-shadow-card)] p-5",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <div>
        <div className="font-semibold text-[var(--ff-text-primary)]">{title}</div>
        {subtitle ? <div className="text-xs text-[var(--ff-text-secondary)]">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}
