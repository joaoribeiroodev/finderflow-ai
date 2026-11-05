/**
 * `color` vem de `pipeline_stages.color`, escolhida livremente pelo
 * usuário em Configurações (qualquer hex) — não há garantia de que um
 * texto nessa cor tenha contraste AA sobre o fundo escuro do card. Em vez
 * de usar `color` como cor do TEXTO (achado do axe-core, "serious",
 * corrigido na Fase 8), ela é usada só no indicador (bolinha) e no
 * tingimento sutil de fundo/borda — o texto em si fica sempre em
 * `--ff-text-primary`, que já é garantido de alto contraste.
 */
export function StagePill({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--ff-radius-pill)] border px-2.5 py-1 text-xs font-medium whitespace-nowrap text-[var(--ff-text-primary)]"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}22` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {name}
    </span>
  );
}
