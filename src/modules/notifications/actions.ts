"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger/logger";

/**
 * Marca uma notificação como lida. Autorização real é a RLS
 * (`notifications_update_own`) — se a notificação não for do usuário
 * autenticado, 0 linhas são afetadas, silenciosamente.
 */
export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);

  if (error) {
    logger.error("Falha ao marcar notificação como lida", { error: error.message, notificationId });
  }

  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(organizationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    logger.error("Falha ao marcar notificações como lidas", { error: error.message, organizationId });
  }

  revalidatePath("/", "layout");
}
