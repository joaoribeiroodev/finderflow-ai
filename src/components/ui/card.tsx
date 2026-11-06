import { type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Superfície de arquivo (reformulação "Registro & Selo", 2026-11-06):
 * uma folha plana e elevada do dossiê — sem o gradiente/raio uniforme de
 * "card SaaS" que o produto tinha antes. Usado como base por `KpiCard`,
 * `ChartCard` e seções de conteúdo soltas; componentes específicos podem
 * sobrepor bordas/divisores (ex.: `border-t-2 border-[var(--ff-brass)]`)
 * para ganhar densidade de registro em vez de caixa genérica.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)]",
        "bg-[var(--ff-bg-surface)] [box-shadow:var(--ff-shadow-card)] p-5",
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
