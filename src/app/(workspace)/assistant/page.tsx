import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = { title: "Assistente IA — FinderFlow AI" };

export default function AssistantPage() {
  return (
    <ComingSoon
      icon={Sparkles}
      eyebrow="Inteligência para sua operação"
      title="FinderFlow Copilot"
      subtitle="Seu assistente de IA para decisões comerciais mais inteligentes."
      phase={5}
      description="O Copilot conversacional, com ferramentas allowlist e acesso apenas a dados autorizados da sua organização, será implementado na Fase 5 (OpenAI)."
    />
  );
}
