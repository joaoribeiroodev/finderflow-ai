export function StagePill({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--ff-radius-pill)] border px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}22`, color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {name}
    </span>
  );
}
