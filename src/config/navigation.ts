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
  Map,
  Lightbulb,
  Megaphone,
  Repeat,
} from "lucide-react";

/**
 * Árvore de navegação do workspace (docs/06-design-system.md §6.4,
 * espelhando `prototype/index.html`). Todo item aponta para uma rota já
 * implementada.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
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
      { href: "/map", label: "Mapa", icon: Map },
      { href: "/leads", label: "Leads", icon: Rows3 },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/assistant", label: "Assistente IA", icon: Sparkles },
      { href: "/services", label: "Serviços", icon: Wrench },
      { href: "/recommendations", label: "Recomendações", icon: Lightbulb },
      { href: "/campaigns", label: "Campanhas", icon: Megaphone },
      { href: "/cadences", label: "Cadências", icon: Repeat },
      { href: "/proposals", label: "Propostas", icon: FileText },
      { href: "/reports", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    label: "Conta",
    items: [
      { href: "/contracts", label: "Contratos", icon: Receipt },
      { href: "/settings", label: "Configurações", icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
