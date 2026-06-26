"use client";

import React from "react";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface PipelineStage {
  id: string;
  name: string;
  status: "success" | "pending" | "warning" | "error";
  duration: string;
}

const stages: PipelineStage[] = [
  { id: "build", name: "Build", status: "success", duration: "2 min" },
  { id: "unit-tests", name: "Unit Tests", status: "success", duration: "3 min" },
  { id: "integration", name: "Integration Tests", status: "success", duration: "5 min" },
  { id: "security", name: "Security Scan", status: "pending", duration: "4 min" },
  { id: "performance", name: "Performance", status: "pending", duration: "3 min" },
  { id: "approval", name: "Manual Approval", status: "warning", duration: "—" },
  { id: "staging", name: "Deploy Staging", status: "pending", duration: "2 min" },
  { id: "production", name: "Deploy Production", status: "pending", duration: "3 min" },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "success":
      return <CheckCircle2 className="w-5 h-5" />;
    case "pending":
      return <Clock className="w-5 h-5" />;
    case "warning":
      return <AlertCircle className="w-5 h-5" />;
    default:
      return null;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "success":
      return "text-[var(--status-success)] bg-[var(--status-success)]/10";
    case "pending":
      return "text-[var(--status-pending)] bg-[var(--status-pending)]/10";
    case "warning":
      return "text-[var(--status-warning)] bg-[var(--status-warning)]/10";
    case "error":
      return "text-[var(--status-error)] bg-[var(--status-error)]/10";
    default:
      return "";
  }
};

export function ReleaseFlowGraph() {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Release Pipeline</h3>
        <p className="text-sm text-[var(--foreground-secondary)]">Deployment workflow visualization</p>
      </div>

      {/* Pipeline flow */}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-3 pb-4 min-w-min">
          {stages.map((stage, index) => (
            <React.Fragment key={stage.id}>
              {/* Stage Node */}
              <div className={`flex flex-col items-center gap-2 ${getStatusColor(stage.status)} p-4 rounded-lg flex-shrink-0`}>
                <div className="flex items-center justify-center">{getStatusIcon(stage.status)}</div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--foreground)]">{stage.name}</p>
                  <p className="text-xs text-[var(--foreground-secondary)]">{stage.duration}</p>
                </div>
              </div>

              {/* Arrow */}
              {index < stages.length - 1 && (
                <div className="text-[var(--border)]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
          <span className="text-[var(--foreground-secondary)]">Passed</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-[var(--status-pending)]" />
          <span className="text-[var(--foreground-secondary)]">In Progress</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 text-[var(--status-warning)]" />
          <span className="text-[var(--foreground-secondary)]">Awaiting</span>
        </div>
      </div>
    </div>
  );
}
