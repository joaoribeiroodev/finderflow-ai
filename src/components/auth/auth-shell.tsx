import type { ReactNode } from "react";

import { LogoBadge } from "@/components/brand/logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ff-bg-canvas)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] p-8 shadow-2xl shadow-black/40">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoBadge size={44} />
          <span className="mt-3 bg-gradient-to-r from-[var(--ff-purple-500)] to-[var(--ff-magenta)] bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            FinderFlow AI
          </span>
          <h1 className="mt-4 text-xl font-semibold text-[var(--ff-text-primary)]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[var(--ff-text-secondary)]">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
      </div>
    </div>
  );
}
