"use client";

import React from "react";

export function Sidebar() {
  const navItems = [
    { name: "Overview", href: "#", icon: "OV", active: true },
    { name: "Releases", href: "#", icon: "RL" },
    { name: "Deployments", href: "#", icon: "DP" },
    { name: "Quality Gates", href: "#", icon: "QG" },
    { name: "Analytics", href: "#", icon: "AN" },
    { name: "Logs", href: "#", icon: "LG" },
    { name: "Settings", href: "#", icon: "ST" },
  ];

  return (
    <aside className="w-64 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--status-pending)] rounded flex items-center justify-center font-bold text-[var(--background)]">
            GF
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)]">GraphFlow</h1>
            <p className="text-xs text-[var(--foreground-secondary)]">Release Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <a
            key={item.name}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              item.active
                ? "bg-[var(--surface-alt)] text-[var(--status-pending)]"
                : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
            }`}
          >
            <span className="w-6 rounded border border-[var(--border)] py-0.5 text-center text-[10px] font-semibold">
              {item.icon}
            </span>
            <span>{item.name}</span>
          </a>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--surface-alt)] rounded-full flex items-center justify-center text-xs font-bold text-[var(--foreground)]">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)] truncate">Account</p>
            <p className="text-xs text-[var(--foreground-secondary)] truncate">admin@company.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
