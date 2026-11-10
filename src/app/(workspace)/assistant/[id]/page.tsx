import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganizationForPage } from "@/modules/organizations/active-organization";
import { getConversationWithMessages } from "@/modules/ai/copilot.service";
import { CopilotChat } from "@/components/ai/copilot-chat";

export const metadata: Metadata = { title: "Conversa — FinderFlow Copilot" };

export default async function AssistantConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activeOrganization = await requireActiveOrganizationForPage();
  const supabase = await createClient();

  const result = await getConversationWithMessages(supabase, activeOrganization.organizationId, id);
  if (!result) notFound();

  const visibleMessages = result.messages
    .filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
    .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content ?? "" }));

  const pendingToolCall = result.conversation.pending_tool_call as { description: string } | null;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <Link
        href="/assistant"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--ff-text-secondary)] hover:text-[var(--ff-text-primary)]"
      >
        <ArrowLeft className="size-4" aria-hidden /> Voltar para conversas
      </Link>

      <CopilotChat
        conversationId={id}
        initialMessages={visibleMessages}
        initialPendingConfirmation={pendingToolCall?.description ?? null}
      />
    </div>
  );
}
