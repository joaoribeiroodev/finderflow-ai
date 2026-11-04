import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

/**
 * Placeholder consistente para telas cuja fase ainda não foi implementada
 * (ver `src/config/navigation.ts`). Evita 404 na navegação do shell sem
 * fingir que a funcionalidade existe — a regra do prompt mestre é não
 * construir telas desconectadas do modelo de dados antes da hora.
 */
export function ComingSoon({
  icon,
  eyebrow,
  title,
  subtitle,
  phase,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle: string;
  phase: number;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={<Badge variant="outline">Chega na Fase {phase}</Badge>}
      />
      <Card>
        <EmptyState icon={icon} title={`Em construção — Fase ${phase}`} description={description} />
      </Card>
    </div>
  );
}
