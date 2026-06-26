"use client";

import { AlertCircle, CheckCircle2, Clock, GitBranch, Lock, RadioTower } from "lucide-react";
import { type FlowEdge, type FlowNode, type Status } from "@/lib/graphflow";

type ReleaseFlowGraphProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  statuses: Record<string, Status>;
  criticalPath: string[];
  blastRadius: string[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
};

const statusConfig: Record<
  Status,
  {
    label: string;
    border: string;
    bg: string;
    text: string;
    icon: typeof Clock;
  }
> = {
  pending: {
    label: "Pending",
    border: "border-[var(--status-neutral)]",
    bg: "bg-[var(--status-neutral)]/10",
    text: "text-[var(--foreground-secondary)]",
    icon: Clock,
  },
  running: {
    label: "Running",
    border: "border-[var(--status-pending)]",
    bg: "bg-[var(--status-pending)]/10",
    text: "text-[var(--status-pending)]",
    icon: RadioTower,
  },
  success: {
    label: "Passed",
    border: "border-[var(--status-success)]",
    bg: "bg-[var(--status-success)]/10",
    text: "text-[var(--status-success)]",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    border: "border-[var(--status-error)]",
    bg: "bg-[var(--status-error)]/10",
    text: "text-[var(--status-error)]",
    icon: AlertCircle,
  },
  blocked: {
    label: "Blocked",
    border: "border-[var(--status-warning)]",
    bg: "bg-[var(--status-warning)]/10",
    text: "text-[var(--status-warning)]",
    icon: Lock,
  },
  waiting: {
    label: "Waiting",
    border: "border-[var(--status-warning)]",
    bg: "bg-[var(--status-warning)]/10",
    text: "text-[var(--status-warning)]",
    icon: Clock,
  },
};

function edgeKey(edge: FlowEdge) {
  return `${edge.from}->${edge.to}`;
}

function edgeInPath(edge: FlowEdge, path: string[]) {
  return path.some((nodeId, index) => nodeId === edge.from && path[index + 1] === edge.to);
}

function nodeTypeLabel(type: FlowNode["type"]) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function ReleaseFlowGraph({
  nodes,
  edges,
  statuses,
  criticalPath,
  blastRadius,
  selectedNodeId,
  onSelectNode,
}: ReleaseFlowGraphProps) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const selectedNode = selectedNodeId ? byId.get(selectedNodeId) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Release Dependency Graph</h3>
            <p className="text-sm text-[var(--foreground-secondary)]">
              Aurora stores the graph. DynamoDB streams live run state into each node.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded border border-[var(--border)] px-2 py-1 text-[var(--foreground-secondary)]">
              {nodes.length} nodes
            </span>
            <span className="rounded border border-[var(--border)] px-2 py-1 text-[var(--foreground-secondary)]">
              {edges.length} dependencies
            </span>
            <span className="rounded border border-[var(--status-pending)] px-2 py-1 text-[var(--status-pending)]">
              Critical path: {criticalPath.length} nodes
            </span>
          </div>
        </div>

        <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <marker id="graph-arrow" markerHeight="5" markerWidth="5" orient="auto" refX="5" refY="2.5">
                <path d="M0,0 L5,2.5 L0,5 Z" fill="currentColor" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const from = byId.get(edge.from);
              const to = byId.get(edge.to);

              if (!from || !to) {
                return null;
              }

              const critical = edgeInPath(edge, criticalPath);
              const impacted = blastRadius.includes(edge.to);
              const fromStatus = statuses[edge.from] ?? "pending";
              const stroke = critical
                ? "var(--status-pending)"
                : impacted
                  ? "var(--status-warning)"
                  : fromStatus === "success"
                    ? "var(--status-success)"
                    : "var(--border)";

              return (
                <line
                  key={edgeKey(edge)}
                  markerEnd="url(#graph-arrow)"
                  stroke={stroke}
                  strokeDasharray={critical ? "0" : impacted ? "3 2" : "5 4"}
                  strokeWidth={critical ? 0.75 : 0.45}
                  x1={from.x}
                  x2={to.x}
                  y1={from.y}
                  y2={to.y}
                />
              );
            })}
          </svg>

          {nodes.map((node) => {
            const status = statuses[node.id] ?? "pending";
            const config = statusConfig[status];
            const Icon = config.icon;
            const critical = criticalPath.includes(node.id);
            const impacted = blastRadius.includes(node.id);
            const selected = selectedNodeId === node.id;

            return (
              <button
                key={node.id}
                onClick={() => onSelectNode?.(node.id)}
                className={`absolute w-36 -translate-x-1/2 -translate-y-1/2 rounded-lg border p-3 text-left shadow-lg transition hover:-translate-y-[52%] hover:border-[var(--status-pending)] ${config.border} ${config.bg} ${
                  selected ? "ring-2 ring-[var(--status-pending)]" : ""
                } ${critical ? "shadow-[0_0_0_1px_var(--status-pending)]" : ""}`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className={`h-4 w-4 ${config.text}`} />
                  <span className={`text-[10px] font-semibold uppercase ${config.text}`}>
                    {config.label}
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold leading-tight text-[var(--foreground)]">{node.label}</div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--foreground-secondary)]">
                  <span>{nodeTypeLabel(node.type)}</span>
                  <span>{node.duration}m</span>
                </div>
                {(critical || impacted) && (
                  <div className="mt-2 flex gap-1">
                    {critical && (
                      <span className="rounded bg-[var(--status-pending)]/15 px-1.5 py-0.5 text-[10px] text-[var(--status-pending)]">
                        Critical
                      </span>
                    )}
                    {impacted && (
                      <span className="rounded bg-[var(--status-warning)]/15 px-1.5 py-0.5 text-[10px] text-[var(--status-warning)]">
                        Impacted
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <GitBranch className="h-4 w-4 text-[var(--status-pending)]" />
          Selected Node
        </div>
        {selectedNode ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--foreground-secondary)]">Node</p>
              <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{selectedNode.label}</p>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <dt className="text-[var(--foreground-secondary)]">Status</dt>
                <dd className={statusConfig[statuses[selectedNode.id] ?? "pending"].text}>
                  {statusConfig[statuses[selectedNode.id] ?? "pending"].label}
                </dd>
              </div>
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <dt className="text-[var(--foreground-secondary)]">Type</dt>
                <dd className="text-[var(--foreground)]">{nodeTypeLabel(selectedNode.type)}</dd>
              </div>
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <dt className="text-[var(--foreground-secondary)]">Duration</dt>
                <dd className="text-[var(--foreground)]">{selectedNode.duration}m</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--foreground-secondary)]">Unlocks</dt>
                <dd className="text-[var(--foreground)]">
                  {edges.filter((edge) => edge.from === selectedNode.id).length}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--foreground-secondary)]">
            Select a graph node to inspect its status, dependency type, and downstream impact.
          </p>
        )}
      </aside>
    </div>
  );
}
