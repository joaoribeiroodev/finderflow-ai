"use client";

import { useState, useTransition } from "react";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import type { NotificationRow } from "@/modules/notifications/notifications.service";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/modules/notifications/actions";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NotificationsBell({
  organizationId,
  initialItems,
  initialUnreadCount,
}: {
  organizationId: string;
  initialItems: NotificationRow[];
  initialUnreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();

  function handleOpen() {
    setOpen((v) => !v);
  }

  function handleMarkOne(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    startTransition(() => {
      void markNotificationReadAction(id);
    });
  }

  function handleMarkAll() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    startTransition(() => {
      void markAllNotificationsReadAction(organizationId);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ""}`}
        aria-expanded={open}
        className="relative flex size-9 items-center justify-center rounded-[var(--ff-radius-sm)] text-[var(--ff-text-secondary)] hover:bg-[var(--ff-bg-elevated)] hover:text-white"
      >
        <Bell className="size-[18px]" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 flex size-[9px] items-center justify-center rounded-full bg-[var(--ff-magenta)]" />
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-2 w-[320px] max-w-[90vw] rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] bg-[var(--ff-bg-sidebar)] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-sm font-semibold text-[var(--ff-text-primary)]">Notificações</p>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  className="text-xs text-[var(--ff-violet-glow)] hover:underline"
                >
                  Marcar todas como lidas
                </button>
              ) : null}
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-[var(--ff-text-muted)]">
                  Nenhuma notificação ainda.
                </p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => (n.readAt ? undefined : handleMarkOne(n.id))}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-[var(--ff-radius-sm)] px-2 py-2 text-left text-sm transition-colors",
                      n.readAt
                        ? "text-[var(--ff-text-muted)]"
                        : "bg-[var(--ff-bg-elevated)] text-[var(--ff-text-primary)] hover:bg-[var(--ff-bg-surface)]",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{n.title}</span>
                      <span className="shrink-0 text-[11px] text-[var(--ff-text-muted)]">
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                    {n.body ? <span className="text-xs text-[var(--ff-text-muted)]">{n.body}</span> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
