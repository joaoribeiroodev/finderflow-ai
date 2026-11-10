import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeDateTime } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganizationForPage } from "@/modules/organizations/active-organization";
import { listConversations } from "@/modules/ai/copilot.service";
import { resolveOpenAiCredentialsForOrganization } from "@/lib/ai/org-credentials";

import { StartConversationButton } from "@/components/ai/start-conversation-button";

export const metadata: Metadata = { title: "Assistente IA — FinderFlow AI" };

export default async function AssistantPage() {
  const activeOrganization = await requireActiveOrganizationForPage();

  // Antes checava só a variável global OPENAI_API_KEY — ignorava a chave
  // que a própria organização configurou em Configurações (Fase 9),
  // deixando o Copilot bloqueado mesmo com a IA já funcionando para o
  // resto do app (análise de empresa, pontuação de lead, etc., que já
  // passavam por este mesmo resolver via `engine.ts`).
  const openAiCredentials = await resolveOpenAiCredentialsForOrganization(
    activeOrganization.organizationId,
  );
  const openAiConfigured = Boolean(openAiCredentials);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const conversations = userId
    ? await listConversations(supabase, activeOrganization.organizationId, userId)
    : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Inteligência para sua operação"
        title="FinderFlow Copilot"
        subtitle="Converse com o assistente sobre leads, tarefas e métricas do funil."
        actions={openAiConfigured ? <StartConversationButton /> : null}
      />

      {!openAiConfigured ? (
        <Card>
          <CardHeader title="IA ainda não configurada" />
          <p className="text-sm text-[var(--ff-text-secondary)]">
            Configure uma chave de API da OpenAI em{" "}
            <Link href="/settings" className="text-[var(--ff-violet-glow)] hover:underline">
              Configurações → Integrações
            </Link>{" "}
            para usar o Copilot. O contrato do Copilot (ferramentas allowlist, confirmação para ações
            sensíveis, quota por organização) já está implementado — assim que a chave for salva, esta
            página passa a funcionar sem nenhuma mudança de código.
          </p>
        </Card>
      ) : conversations.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Nenhuma conversa ainda"
            description="Comece uma conversa para pedir informações sobre leads, tarefas e métricas, ou para criar tarefas e mover leads de etapa (com sua confirmação)."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Suas conversas" />
          <ul className="flex flex-col divide-y divide-[var(--ff-border-subtle)]">
            {conversations.map((conversation) => (
              <li key={conversation.id} className="py-3">
                <Link
                  href={`/assistant/${conversation.id}`}
                  className="flex items-center justify-between gap-3 text-sm hover:text-[var(--ff-violet-glow)]"
                >
                  <span className="text-[var(--ff-text-primary)]">
                    {conversation.title ?? "Conversa sem título"}
                  </span>
                  <span className="text-xs text-[var(--ff-text-muted)]">
                    {formatRelativeDateTime(conversation.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
