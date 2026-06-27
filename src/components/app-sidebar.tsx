"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import {
  primaryConsoleSections,
  secondaryConsoleSections,
  type ConsoleSection,
} from "@/lib/console-sections";

type AppSidebarProps = {
  activeSection: ConsoleSection;
  onSectionChange: (section: ConsoleSection) => void;
};

export function AppSidebar({ activeSection, onSectionChange }: AppSidebarProps) {
  return (
    <div className="w-64 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col h-full">
      <div className="p-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--status-pending)] rounded-lg flex items-center justify-center">
            <span className="text-sm font-bold text-[var(--background)]">GF</span>
          </div>
          <div>
            <h1 className="font-semibold text-[var(--foreground)]">GraphFlow</h1>
            <p className="text-xs text-[var(--foreground-secondary)]">Release Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {primaryConsoleSections.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.label}
              onClick={() => onSectionChange(item.id)}
              className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                isActive
                  ? "bg-[var(--status-pending)] text-[var(--background)]"
                  : "text-[var(--foreground-secondary)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 space-y-1 border-t border-[var(--border)]">
        {secondaryConsoleSections.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.label}
              onClick={() => onSectionChange(item.id)}
              className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                isActive
                  ? "bg-[var(--status-pending)] text-[var(--background)]"
                  : "text-[var(--foreground-secondary)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--background)] cursor-pointer transition-colors group">
          <div className="w-8 h-8 bg-[var(--status-pending)] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-[var(--background)]">GF</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)] truncate">GraphFlow Admin</p>
            <p className="text-xs text-[var(--foreground-secondary)] truncate">Platform console</p>
          </div>
          <ChevronDown className="w-4 h-4 text-[var(--foreground-secondary)] group-hover:text-[var(--foreground)]" />
        </div>
      </div>
    </div>
  );
}
