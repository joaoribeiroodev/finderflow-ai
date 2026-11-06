"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";

import { logoutAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";

export function UserMenu({ userEmail, roleLabel }: { userEmail: string | null; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const initials = (userEmail ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu do usuário"
        aria-expanded={open}
        title={userEmail ?? undefined}
        className="flex size-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed,#d946ef)] text-xs font-bold text-white"
      >
        {initials}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-2 w-[240px] rounded-[var(--ff-radius-md)] border border-[var(--ff-border-subtle)] bg-[#150f23] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            <div className="border-b border-[var(--ff-border-subtle)] px-2 pb-2">
              <p className="truncate text-sm font-medium text-[var(--ff-text-primary)]">
                {userEmail ?? "—"}
              </p>
              <p className="text-xs text-[var(--ff-text-muted)]">{roleLabel}</p>
            </div>
            <div className="flex flex-col gap-1 pt-2">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-[var(--ff-radius-sm)] px-2 py-2 text-sm text-[var(--ff-text-secondary)] hover:bg-[#201832] hover:text-white"
              >
                <Settings className="size-4" aria-hidden />
                Configurações
              </Link>
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
                  Sair
                </Button>
              </form>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
