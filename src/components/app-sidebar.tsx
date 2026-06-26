"use client";

import React from "react";
import {
  LayoutDashboard,
  GitBranch,
  Server,
  CheckSquare,
  BarChart3,
  FileText,
  Settings,
  ChevronDown,
} from "lucide-react";

const navigation = [
  { icon: LayoutDashboard, label: "Overview", href: "#" },
  { icon: GitBranch, label: "Releases", href: "#" },
  { icon: Server, label: "Deployments", href: "#" },
  { icon: CheckSquare, label: "Quality Gates", href: "#" },
  { icon: BarChart3, label: "Analytics", href: "#" },
  { icon: FileText, label: "Logs", href: "#" },
];

const secondary = [
  { icon: Settings, label: "Settings", href: "#" },
  { icon: FileText, label: "Documentation", href: "#" },
];

export function AppSidebar() {
  return (
    <div className="w-64 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col h-full">
      {/* Logo */}
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

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item, index) => {
          const Icon = item.icon;
          const isActive = index === 0;
          return (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-[var(--status-pending)] text-[var(--background)]"
                  : "text-[var(--foreground-secondary)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </a>
          );
        })}
      </nav>

      {/* Secondary Navigation */}
      <div className="p-4 space-y-1 border-t border-[var(--border)]">
        {secondary.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-[var(--foreground-secondary)] hover:bg-[var(--background)] hover:text-[var(--foreground)] transition-colors"
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </a>
          );
        })}
      </div>

      {/* User Section */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--background)] cursor-pointer transition-colors group">
          <div className="w-8 h-8 bg-[var(--status-pending)] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-[var(--background)]">SC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)] truncate">Sarah Chen</p>
            <p className="text-xs text-[var(--foreground-secondary)] truncate">admin@graphflow.io</p>
          </div>
          <ChevronDown className="w-4 h-4 text-[var(--foreground-secondary)] group-hover:text-[var(--foreground)]" />
        </div>
      </div>
    </div>
  );
}
