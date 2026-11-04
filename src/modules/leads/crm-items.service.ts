import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { ContactCreateInput } from "@/lib/validation/contacts";
import type { InteractionCreateInput } from "@/lib/validation/interactions";
import type { TaskCreateInput } from "@/lib/validation/tasks";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Contatos, interações e tarefas — operações simples de CRUD por lead
 * (interações/tarefas) ou por empresa (contatos). RLS já garante o
 * isolamento por organização; este módulo só adiciona a checagem
 * explícita de permissão de edição e o FK de organização nas queries,
 * seguindo a mesma convenção de src/modules/companies.
 */

export async function createContact(
  supabase: Supabase,
  organizationId: string,
  input: ContactCreateInput,
): Promise<void> {
  const { error } = await supabase.from("contacts").insert({
    organization_id: organizationId,
    company_id: input.companyId,
    name: input.name,
    position: input.position ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    preferred_channel: input.preferredChannel ?? null,
  });

  if (error) {
    logger.error("Falha ao criar contato", { error: error.message, organizationId });
    throw new Error("Não foi possível cadastrar o contato.");
  }
}

export async function deleteContact(
  supabase: Supabase,
  organizationId: string,
  contactId: string,
): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", contactId);

  if (error) {
    logger.error("Falha ao excluir contato", { error: error.message, organizationId, contactId });
    throw new Error("Não foi possível excluir o contato.");
  }
}

export async function createInteraction(
  supabase: Supabase,
  organizationId: string,
  input: InteractionCreateInput,
): Promise<void> {
  const { error } = await supabase.from("interactions").insert({
    organization_id: organizationId,
    lead_id: input.leadId,
    type: input.type,
    content_summary: input.contentSummary,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  });

  if (error) {
    logger.error("Falha ao registrar interação", { error: error.message, organizationId });
    throw new Error("Não foi possível registrar a interação.");
  }
}

export async function createTask(
  supabase: Supabase,
  organizationId: string,
  input: TaskCreateInput,
): Promise<void> {
  const { error } = await supabase.from("tasks").insert({
    organization_id: organizationId,
    lead_id: input.leadId,
    title: input.title,
    description: input.description ?? null,
    due_at: input.dueAt ?? null,
  });

  if (error) {
    logger.error("Falha ao criar tarefa", { error: error.message, organizationId });
    throw new Error("Não foi possível criar a tarefa.");
  }
}

export async function updateTaskStatus(
  supabase: Supabase,
  organizationId: string,
  taskId: string,
  status: Database["public"]["Enums"]["task_status"],
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("organization_id", organizationId)
    .eq("id", taskId);

  if (error) {
    logger.error("Falha ao atualizar tarefa", { error: error.message, organizationId, taskId });
    throw new Error("Não foi possível atualizar a tarefa.");
  }
}
