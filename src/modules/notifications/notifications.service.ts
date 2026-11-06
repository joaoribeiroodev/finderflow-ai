import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger/logger";
import type { Database, Json } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  metadata: unknown;
}

/**
 * Lista as notificações do usuário autenticado na organização ativa.
 * Depende de RLS (`notifications_select_own`: `user_id = auth.uid() and
 * is_org_member(organization_id)`), mas como todas as outras consultas
 * "minhas próprias" no projeto, também filtra explicitamente por
 * `user_id` e `organization_id` — nunca confia só na RLS.
 */
export async function listNotifications(
  supabase: Supabase,
  organizationId: string,
  userId: string,
  limit = 20,
): Promise<{ items: NotificationRow[]; unreadCount: number }> {
  const [{ data, error }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, read_at, created_at, metadata")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .is("read_at", null),
  ]);

  if (error) {
    logger.error("Falha ao listar notificações", { error: error.message, organizationId });
    return { items: [], unreadCount: 0 };
  }

  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      readAt: row.read_at,
      createdAt: row.created_at,
      metadata: row.metadata,
    })),
    unreadCount: unreadCount ?? 0,
  };
}

/**
 * Cria notificações (via cliente admin — não há policy de insert para
 * `authenticated`, de propósito: o remetente nunca é o próprio usuário).
 * Melhor esforço: nunca lança, só loga em caso de falha, para não
 * derrubar a ação de negócio que está notificando.
 */
export async function notifyUsers(
  organizationId: string,
  userIds: string[],
  notification: { type: string; title: string; body?: string; metadata?: Json },
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert(
      userIds.map((userId) => ({
        organization_id: organizationId,
        user_id: userId,
        type: notification.type,
        title: notification.title,
        body: notification.body ?? null,
        metadata: notification.metadata ?? {},
      })),
    );
    if (error) {
      logger.error("Falha ao criar notificações", { error: error.message, organizationId });
    }
  } catch (error) {
    logger.error("Falha ao criar notificações (cliente admin indisponível)", {
      error: (error as Error).message,
      organizationId,
    });
  }
}
