import { cn } from "@/lib/utils/cn";

/**
 * Skeleton de carregamento genérico. Respeita `prefers-reduced-motion`
 * (regra global em globals.css desativa a animação de pulso).
 */
export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-[var(--ff-radius-md)] bg-[var(--ff-bg-elevated)]",
        className,
      )}
    />
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--ff-radius-lg)] border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-surface)] p-5">
      <div className="flex items-center justify-between">
        <LoadingSkeleton className="h-3 w-24" />
        <LoadingSkeleton className="size-9 rounded-[var(--ff-radius-md)]" />
      </div>
      <LoadingSkeleton className="h-7 w-20" />
      <LoadingSkeleton className="h-3 w-32" />
    </div>
  );
}
