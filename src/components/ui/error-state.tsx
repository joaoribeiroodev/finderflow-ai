import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function ErrorState({
  title = "Não foi possível carregar os dados",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-[var(--ff-radius-lg)] border border-[#713047] bg-[#421c2a]/40 px-6 py-8 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-[var(--ff-radius-md)] bg-[#421c2a] text-[var(--ff-danger)]">
        <AlertTriangle className="size-5" aria-hidden />
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
