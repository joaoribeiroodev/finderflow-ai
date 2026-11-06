import { type HTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Superfície de arquivo: uma folha elevada do dossiê, sem o tratamento
 * uniforme de card SaaS. Componentes específicos podem optar por linhas e
 * divisores para ganhar densidade de registro.
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
