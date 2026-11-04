"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { AIProviderNotConfiguredError } from "@/lib/ai/provider";
import { AIQuotaExceededError } from "@/lib/ai/quota";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/modules/organizations/active-organization";

import {
  confirmPendingToolCall,
  ConversationNotFoundError,
  createConversation,
  NoPendingToolCallError,
  rejectPendingToolCall,
  sendCopilotMessage,
  type CopilotTurnResult,
} from "./copilot.service";

export interface CopilotActionResult {
  success: boolean;
  message?: string;
  notConfigured?: boolean;
  turn?: CopilotTurnResult;
}

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("NÃO AUTENTICADO");
  return data.user.id;
}

function mapKnownError(error: unknown): CopilotActionResult {
  if (error instanceof AIProviderNotConfiguredError) {
    return { success: false, message: error.message, notConfigured: true };
  }
  if (
    error instanceof AIQuotaExceededError ||
    error instanceof ConversationNotFoundError ||
    error instanceof NoPendingToolCallError
  ) {
    return { success: false, message: error.message };
  }
  return { success: false, message: error instanceof Error ? error.message : "Falha inesperada." };
}

/** Cria uma nova conversa e redireciona para ela — usado pelo botão "Nova conversa". */
export async function startConversationAction(): Promise<void> {
  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();
  const userId = await requireUserId();

  const conversation = await createConversation(supabase, organizationId, userId);
  revalidatePath("/assistant");
  redirect(`/assistant/${conversation.id}`);
}

export async function sendCopilotMessageAction(
  _prev: CopilotActionResult,
  formData: FormData,
): Promise<CopilotActionResult> {
  const conversationId = formData.get("conversationId");
  const text = formData.get("text");
  if (typeof conversationId !== "string" || conversationId.length === 0) {
    return { success: false, message: "Conversa inválida." };
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    return { success: false, message: "Digite uma mensagem." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();
  const userId = await requireUserId();

  try {
    const turn = await sendCopilotMessage(supabase, organizationId, userId, conversationId, text.trim());
    revalidatePath(`/assistant/${conversationId}`);
    return { success: turn.kind !== "error", turn };
  } catch (error) {
    return mapKnownError(error);
  }
}

export async function confirmPendingToolCallAction(
  _prev: CopilotActionResult,
  formData: FormData,
): Promise<CopilotActionResult> {
  const conversationId = formData.get("conversationId");
  if (typeof conversationId !== "string" || conversationId.length === 0) {
    return { success: false, message: "Conversa inválida." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();
  const userId = await requireUserId();

  try {
    const turn = await confirmPendingToolCall(supabase, organizationId, userId, conversationId);
    revalidatePath(`/assistant/${conversationId}`);
    return { success: turn.kind !== "error", turn };
  } catch (error) {
    return mapKnownError(error);
  }
}

export async function rejectPendingToolCallAction(
  _prev: CopilotActionResult,
  formData: FormData,
): Promise<CopilotActionResult> {
  const conversationId = formData.get("conversationId");
  if (typeof conversationId !== "string" || conversationId.length === 0) {
    return { success: false, message: "Conversa inválida." };
  }

  const supabase = await createClient();
  const { organizationId } = await requireActiveOrganization();
  const userId = await requireUserId();

  try {
    const turn = await rejectPendingToolCall(supabase, organizationId, userId, conversationId);
    revalidatePath(`/assistant/${conversationId}`);
    return { success: turn.kind !== "error", turn };
  } catch (error) {
    return mapKnownError(error);
  }
}
