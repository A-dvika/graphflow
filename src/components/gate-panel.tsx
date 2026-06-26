"use client";

import { releaseNodes, type Status } from "@/lib/graphflow";

interface GatePanelProps {
  statuses: Record<string, Status>;
}

const statusLabels: Record<Status, string> = {
  pending: "Pending",
  running: "Running",
  success: "Succeeded",
  failed: "Failed",
  blocked: "Blocked",
  waiting: "Waiting",
};

export function GatePanel({ statuses }: GatePanelProps) {
  const blockedCount = Object.values(statuses).filter(s => s === "blocked").length;
  const completedCount = Object.values(statuses).filter(s => s === "success").length;
  const totalCount = releaseNodes.length;
  const progressPercent = (completedCount / totalCount) * 100;

  // Determine overall verdict
  let verdict: "PASS" | "CAUTION" | "FAIL" = "PASS";
  let verdictColor = "var(--success-green)";
  if (blockedCount > 0 || Object.values(statuses).some(s => s === "waiting")) {
    verdict = "CAUTION";
    verdictColor = "var(--warning-orange)";
  }
  if (Object.values(statuses).some(s => s === "failed")) {
    verdict = "FAIL";
    verdictColor = "var(--error-red)";
  }

  return (
    <div className="space-y-4">
      {/* Verdict Badge */}
      <div
        className="rounded-lg p-6 border-2"
        style={{ borderColor: verdictColor, backgroundColor: `rgba(${verdict === "PASS" ? "16, 185, 129" : verdict === "CAUTION" ? "245, 158, 11" : "239, 68, 68"}, 0.1)` }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Release Verdict</p>
        <p
          className="text-4xl font-bold mt-2"
          style={{ color: verdictColor }}
        >
          {verdict}
        </p>
        <p className="text-sm text-gray-300 mt-2">
          {verdict === "PASS"
            ? "All checks passed. Ready for production."
            : verdict === "CAUTION"
              ? "Some checks need attention before proceeding."
              : "Critical failures detected. Release blocked."}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">Release Progress</p>
          <p className="text-xs text-gray-400">
            {completedCount}/{totalCount} complete
          </p>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-[var(--success-green)] h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Node Status List */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
        <p className="text-sm font-semibold mb-3">Node Status</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {releaseNodes.map(node => {
            const status = statuses[node.id];
            const statusColor =
              status === "success" ? "var(--success-green)" :
              status === "failed" ? "var(--error-red)" :
              status === "blocked" ? "var(--warning-orange)" :
              status === "running" ? "var(--primary-blue)" :
              status === "waiting" ? "var(--pending-purple)" : "#6b7280";

            return (
              <div key={node.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: statusColor }}
                  />
                  <span className="text-gray-300">{node.label}</span>
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: statusColor }}
                >
                  {statusLabels[status]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Decision Info */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
        <p className="text-sm font-semibold mb-3">Decision Summary</p>
        <div className="space-y-2 text-xs text-gray-400">
          <div className="flex justify-between">
            <span>Completed</span>
            <span className="text-[var(--success-green)] font-semibold">{completedCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Blocked</span>
            <span className="text-[var(--warning-orange)] font-semibold">{blockedCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Nodes</span>
            <span className="text-gray-300 font-semibold">{totalCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
