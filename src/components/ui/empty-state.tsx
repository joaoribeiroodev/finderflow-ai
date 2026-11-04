import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-[var(--ff-radius-lg)] border border-dashed border-[var(--ff-border-subtle)] px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-[var(--ff-radius-md)] bg-[rgba(117,65,200,0.17)] text-[var(--ff-violet-glow)]">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="font-medium text-[var(--ff-text-primary)]">{title}</p>
        {description ? (
          <p className="mt-1 max-w-sm text-sm text-[var(--ff-text-muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
