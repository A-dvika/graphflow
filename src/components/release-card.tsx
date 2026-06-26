"use client";

import React from "react";

interface ReleaseCardProps {
  releaseId: string;
  version: string;
  branch: string;
  environment: string;
  status: "success" | "pending" | "warning" | "error";
  progress: number;
  timestamp: string;
  author: string;
  checksPass: number;
  checksTotal: number;
}

const statusConfig = {
  success: { label: "Ready", color: "success", bg: "rgba(63, 185, 80, 0.1)" },
  pending: { label: "In Progress", color: "pending", bg: "rgba(88, 166, 255, 0.1)" },
  warning: { label: "Caution", color: "warning", bg: "rgba(210, 153, 34, 0.1)" },
  error: { label: "Failed", color: "error", bg: "rgba(248, 81, 73, 0.1)" },
};

export function ReleaseCard({
  releaseId,
  version,
  branch,
  environment,
  status,
  progress,
  timestamp,
  author,
  checksPass,
  checksTotal,
}: ReleaseCardProps) {
  const config = statusConfig[status];
  const boundedProgress = Math.max(0, Math.min(progress, 100));

  return (
    <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg p-6 hover:border-[var(--foreground-secondary)] transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">{version}</h3>
          <p className="text-sm text-[var(--foreground-secondary)] mt-1">Release {releaseId}</p>
        </div>
        <div className={`status-badge ${status}`}>
          <span className={`dot ${status}`}></span>
          {config.label}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-[var(--foreground-secondary)] uppercase tracking-wide">Branch</p>
          <p className="text-sm text-[var(--foreground)] font-medium mt-1">{branch}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--foreground-secondary)] uppercase tracking-wide">Environment</p>
          <p className="text-sm text-[var(--foreground)] font-medium mt-1">{environment}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[var(--foreground-secondary)] uppercase tracking-wide">Release Progress</p>
          <p className="text-xs font-medium text-[var(--foreground-secondary)]">{boundedProgress}%</p>
        </div>
        <div className="w-full bg-[var(--surface)] rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-[var(--status-pending)] transition-all duration-300"
            style={{ width: `${boundedProgress}%` }}
          ></div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[var(--foreground-secondary)] uppercase tracking-wide">Quality Gates</p>
          <p className="text-xs font-medium text-[var(--foreground-secondary)]">
            {checksPass}/{checksTotal}
          </p>
        </div>
        <div className="w-full bg-[var(--surface)] rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-[var(--status-success)] transition-all duration-300"
            style={{ width: `${(checksPass / checksTotal) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
        <div className="text-xs text-[var(--foreground-secondary)]">
          <p>by {author}</p>
          <p className="mt-1">{timestamp}</p>
        </div>
        <button className="px-3 py-1.5 rounded text-sm font-medium text-[var(--status-pending)] hover:bg-[var(--surface)] transition-colors">
          View Details -&gt;
        </button>
      </div>
    </div>
  );
}
