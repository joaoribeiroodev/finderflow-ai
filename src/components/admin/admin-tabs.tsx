"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface AdminTab {
  key: string;
  label: string;
  content: ReactNode;
}

export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Seções do painel admin"
        className="flex flex-wrap gap-2 border-b border-[var(--ff-border-subtle)] pb-2"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              "rounded-[var(--ff-radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              active === tab.key
                ? "bg-[var(--ff-bg-elevated)] text-white"
                : "text-[var(--ff-text-secondary)] hover:bg-[var(--ff-bg-elevated)] hover:text-white",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" hidden={active !== tab.key}>
          {active === tab.key ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
