/**
 * Marca do FinderFlow AI — lupa (prospecção) com um brilho (IA), nos
 * mesmos tons de roxo→magenta do design system. Um único lugar para a
 * marca: qualquer ajuste visual futuro passa por aqui em vez de ser
 * reconstruído onde for usado (sidebar, telas de autenticação, etc.).
 * O favicon/ícone do app (`src/app/icon.svg`, `apple-icon.png`,
 * `favicon.ico`) é gerado a partir do mesmo desenho em `public/brand/mark.svg`.
 */
export function LogoMark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden>
      <circle cx="10" cy="10" r="5.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.7 13.7L18.3 18.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M17 3.9L17.42 5.58L19.1 6L17.42 6.42L17 8.1L16.58 6.42L14.9 6L16.58 5.58Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function LogoBadge({ size = 34 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[var(--ff-radius-md)] bg-[linear-gradient(135deg,var(--ff-purple-500),var(--ff-magenta))] text-white [box-shadow:var(--ff-shadow-glow-purple)]"
      style={{ width: size, height: size }}
    >
      <LogoMark className="text-white" style={{ width: size * 0.53, height: size * 0.53 }} />
    </span>
  );
}

export function Logo({
  size = 34,
  showWordmark = true,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoBadge size={size} />
      {showWordmark ? (
        <span className="font-bold tracking-tight">
          FinderFlow <em className="font-normal text-[var(--ff-violet-glow)] not-italic">AI</em>
        </span>
      ) : null}
    </span>
  );
}
