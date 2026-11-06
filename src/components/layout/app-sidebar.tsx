"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Zap } from "lucide-react";

import { NAV_SECTIONS } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";

export function AppSidebar({
  mobileOpen,
  onClose,
  isSuperAdmin = false,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop do drawer mobile */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        id="app-sidebar"
        aria-label="Navegação principal"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col gap-7 border-r border-[var(--ff-border-subtle)] bg-[linear-gradient(180deg,#120e20,#0e0b17)] p-4 transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-0.5 font-bold tracking-tight">
          <span className="flex size-[34px] items-center justify-center rounded-[var(--ff-radius-md)] bg-[linear-gradient(135deg,var(--ff-purple-500),var(--ff-magenta))] text-white [box-shadow:var(--ff-shadow-glow-purple)]">
            <Zap className="size-[18px]" aria-hidden />
          </span>
          <span>
            FinderFlow <em className="font-normal text-[var(--ff-violet-glow)] not-italic">AI</em>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[10px] font-bold tracking-widest text-[var(--ff-text-muted)] uppercase">
                {section.label}
              </p>
              <div className="grid gap-1">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-[var(--ff-radius-sm)] px-3 py-2.5 text-sm text-[var(--ff-text-secondary)] transition-colors duration-150",
                        "hover:bg-[#201832] hover:text-white",
                        active &&
                          "bg-[linear-gradient(90deg,rgba(109,40,217,0.2),rgba(139,92,246,0.13))] text-white shadow-[inset_2px_0_0_var(--ff-purple-500)]",
                      )}
                    >
                      <Icon className="size-[18px] text-[var(--ff-violet-glow)]" aria-hidden />
                      {item.label}
                      {item.comingInPhase ? (
                        <span className="ml-auto rounded-full border border-[var(--ff-border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--ff-text-muted)]">
                          Fase {item.comingInPhase}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {isSuperAdmin ? (
            <div>
              <p className="mb-2 px-3 text-[10px] font-bold tracking-widest text-[var(--ff-text-muted)] uppercase">
                Plataforma
              </p>
              <div className="grid gap-1">
                <Link
                  href="/admin"
                  onClick={onClose}
                  aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--ff-radius-sm)] px-3 py-2.5 text-sm text-[var(--ff-text-secondary)] transition-colors duration-150",
                    "hover:bg-[#201832] hover:text-white",
                    pathname.startsWith("/admin") &&
                      "bg-[linear-gradient(90deg,rgba(109,40,217,0.2),rgba(139,92,246,0.13))] text-white shadow-[inset_2px_0_0_var(--ff-purple-500)]",
                  )}
                >
                  <ShieldCheck className="size-[18px] text-[var(--ff-violet-glow)]" aria-hidden />
                  Painel admin
                </Link>
              </div>
            </div>
          ) : null}
        </nav>
      </aside>
    </>
  );
}
