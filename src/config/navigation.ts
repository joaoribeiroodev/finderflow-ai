import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Search,
  Building2,
  KanbanSquare,
  Rows3,
  Sparkles,
  Wrench,
  FileText,
  BarChart3,
  Receipt,
  Settings,
} from "lucide-react";

/**
 * Árvore de navegação do workspace (docs/06-design-system.md §6.4,
 * espelhando `prototype/index.html`).
 *
 * Itens cuja fase ainda não foi implementada apontam para uma página
 * "em breve" (ver `src/components/layout/coming-soon.tsx`) em vez de uma
 * rota inexistente — evita 404 e deixa claro o que falta, sem fingir que a
 * funcionalidade já existe (regra do prompt mestre: não construir telas
 * desconectadas do modelo de dados antes da hora).
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Fase do prompt mestre que entrega esta tela; `undefined` = já disponível. */
  comingInPhase?: number;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
      { href: "/prospecting", label: "Prospecção", icon: Search },
      { href: "/companies", label: "Empresas", icon: Building2 },
      { href: "/leads", label: "Leads", icon: Rows3 },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/assistant", label: "Assistente IA", icon: Sparkles },
      { href: "/services", label: "Serviços", icon: Wrench },
      { href: "/proposals", label: "Propostas", icon: FileText },
      { href: "/reports", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    label: "Conta",
    items: [
      { href: "/contracts", label: "Contratos", icon: Receipt, comingInPhase: 9 },
      { href: "/settings", label: "Configurações", icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
