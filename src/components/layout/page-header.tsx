import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-[11px] font-bold tracking-widest text-[var(--ff-violet-glow)] uppercase">
          {eyebrow}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ff-text-primary)] sm:text-[27px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--ff-text-secondary)]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
