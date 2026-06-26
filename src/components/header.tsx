"use client";

import React from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="px-8 py-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
