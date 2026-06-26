"use client";

import React from "react";
import { Bell, HelpCircle, Search, Settings } from "lucide-react";
import { type ConsoleSection } from "@/lib/console-sections";

type AppHeaderProps = {
  activeSection: ConsoleSection;
  onSectionChange: (section: ConsoleSection) => void;
  title: string;
};

export function AppHeader({ activeSection, onSectionChange, title }: AppHeaderProps) {
  return (
    <div className="h-16 bg-[var(--surface)] border-b border-[var(--border)] px-6 flex items-center justify-between">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--foreground-secondary)]" />
          <input
            type="text"
            aria-label="Search GraphFlow"
            placeholder={`Search ${title.toLowerCase()}...`}
            className="w-full pl-10 pr-4 py-2 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-secondary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--status-pending)]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-medium uppercase text-[var(--foreground-secondary)] md:inline-flex">
          {activeSection.replace("-", " ")}
        </span>
        <button
          aria-label="Open documentation help"
          onClick={() => onSectionChange("documentation")}
          className="p-2 text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background)] rounded-lg transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <button
          aria-label="Open release alerts"
          onClick={() => onSectionChange("logs")}
          className="p-2 text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background)] rounded-lg transition-colors relative"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--status-error)] rounded-full" />
        </button>
        <button
          aria-label="Open console settings"
          onClick={() => onSectionChange("settings")}
          className="p-2 text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background)] rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
