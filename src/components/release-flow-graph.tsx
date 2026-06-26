"use client";

import { useMemo } from "react";
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

type PositionedNode = FlowNode & {
  column: number;
  x: number;
  y: number;
};

const CARD_WIDTH = 176;
const CARD_HEIGHT = 108;
const COLUMN_GAP = 240;
const ROW_GAP = 136;
const PADDING_X = 44;
const PADDING_TOP = 72;
const PADDING_BOTTOM = 40;

const statusConfig: Record<
  Status,
  {
    label: string;
    border: string;
    bg: string;
    text: string;
    icon: typeof Clock;
    edge: string;
  }
> = {
  pending: {
    label: "Pending",
    border: "border-[var(--status-neutral)]",
    bg: "bg-[var(--status-neutral)]/10",
    text: "text-[var(--foreground-secondary)]",
    icon: Clock,
    edge: "var(--border)",
  },
  running: {
    label: "Running",
    border: "border-[var(--status-pending)]",
    bg: "bg-[var(--status-pending)]/10",
    text: "text-[var(--status-pending)]",
    icon: RadioTower,
    edge: "var(--status-pending)",
  },
  success: {
    label: "Passed",
    border: "border-[var(--status-success)]",
    bg: "bg-[var(--status-success)]/10",
    text: "text-[var(--status-success)]",
    icon: CheckCircle2,
    edge: "var(--status-success)",
  },
  failed: {
    label: "Failed",
    border: "border-[var(--status-error)]",
    bg: "bg-[var(--status-error)]/10",
    text: "text-[var(--status-error)]",
    icon: AlertCircle,
    edge: "var(--status-error)",
  },
  blocked: {
    label: "Blocked",
    border: "border-[var(--status-warning)]",
    bg: "bg-[var(--status-warning)]/10",
    text: "text-[var(--status-warning)]",
    icon: Lock,
    edge: "var(--status-warning)",
  },
  waiting: {
    label: "Waiting",
    border: "border-[var(--status-warning)]",
    bg: "bg-[var(--status-warning)]/10",
    text: "text-[var(--status-warning)]",
    icon: Clock,
    edge: "var(--status-warning)",
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

function stageLabel(nodes: FlowNode[]) {
  const types = new Set(nodes.map((node) => node.type));

  if (types.has("approval")) return "Approval";
  if (types.has("deploy")) return "Deploy";
  if (types.has("security")) return "Risk";
  if (types.has("quality")) return "Validate";
  return "Build";
}

function buildGraphLayout(nodes: FlowNode[], edges: FlowEdge[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));

  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) {
      continue;
    }

    outgoing.get(edge.from)?.push(edge.to);
    incoming.get(edge.to)?.push(edge.from);
  }

  const indegree = new Map(nodes.map((node) => [node.id, incoming.get(node.id)?.length ?? 0]));
  const level = new Map(nodes.map((node) => [node.id, 0]));
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const visited: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    visited.push(current);

    for (const child of outgoing.get(current) ?? []) {
      level.set(child, Math.max(level.get(child) ?? 0, (level.get(current) ?? 0) + 1));
      const nextDegree = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, nextDegree);

      if (nextDegree === 0) {
        queue.push(child);
      }
    }
  }

  if (visited.length !== nodes.length) {
    nodes.forEach((node, index) => {
      if (!visited.includes(node.id)) {
        level.set(node.id, Math.floor(index / 2));
      }
    });
  }

  const columnIndexes = [...new Set(nodes.map((node) => level.get(node.id) ?? 0))].sort((a, b) => a - b);
  const columns = columnIndexes.map((item) =>
    nodes
      .filter((node) => (level.get(node.id) ?? 0) === item)
      .sort((a, b) => a.y - b.y || a.x - b.x || a.label.localeCompare(b.label)),
  );
  const maxRows = Math.max(1, ...columns.map((column) => column.length));
  const width = Math.max(900, PADDING_X * 2 + CARD_WIDTH + Math.max(0, columns.length - 1) * COLUMN_GAP);
  const height = Math.max(420, PADDING_TOP + PADDING_BOTTOM + CARD_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP);
  const positions = new Map<string, PositionedNode>();

  columns.forEach((column, columnIndex) => {
    const columnHeight = CARD_HEIGHT + Math.max(0, column.length - 1) * ROW_GAP;
    const availableHeight = height - PADDING_TOP - PADDING_BOTTOM;
    const offsetY = Math.max(0, (availableHeight - columnHeight) / 2);

    column.forEach((node, rowIndex) => {
      positions.set(node.id, {
        ...node,
        column: columnIndex,
        x: PADDING_X + columnIndex * COLUMN_GAP,
        y: PADDING_TOP + offsetY + rowIndex * ROW_GAP,
      });
    });
  });

  return {
    columns,
    height,
    positions,
    width,
  };
}

function edgePath(from: PositionedNode, to: PositionedNode) {
  const startX = from.x + CARD_WIDTH;
  const startY = from.y + CARD_HEIGHT / 2;
  const endX = to.x;
  const endY = to.y + CARD_HEIGHT / 2;
  const distance = Math.max(72, endX - startX);
  const curve = Math.min(120, distance * 0.5);

  return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
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
  const layout = useMemo(() => buildGraphLayout(nodes, edges), [nodes, edges]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = selectedNodeId ? byId.get(selectedNodeId) : null;
  const selectedDependencies = selectedNode
    ? {
        incoming: edges.filter((edge) => edge.to === selectedNode.id).length,
        outgoing: edges.filter((edge) => edge.from === selectedNode.id).length,
      }
    : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Release Dependency Graph</h3>
            <p className="text-sm text-[var(--foreground-secondary)]">
              A staged view of the live release graph, gate impact, and dependency flow.
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

        <div className="mb-3 flex flex-wrap gap-3 text-xs text-[var(--foreground-secondary)]">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-8 rounded bg-[var(--status-pending)]" />
            Critical path
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-8 rounded bg-[var(--status-warning)]" />
            Blocked impact
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-8 rounded bg-[var(--border)]" />
            Dependency
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)]">
          <div
            className="relative"
            style={{
              height: layout.height,
              minWidth: layout.width,
            }}
          >
            <div className="absolute inset-0">
              {layout.columns.map((column, index) => (
                <div
                  key={`${index}-${column.map((node) => node.id).join("-")}`}
                  className="absolute top-0 h-full border-l border-[var(--border)]/60"
                  style={{ left: PADDING_X + index * COLUMN_GAP - 22 }}
                >
                  <div className="ml-3 mt-4 text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-secondary)]">
                    {stageLabel(column)}
                  </div>
                </div>
              ))}
            </div>

            <svg
              aria-hidden="true"
              className="absolute inset-0 z-0"
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              width={layout.width}
            >
              <defs>
                <marker id="graph-arrow-readable" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                  <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const from = layout.positions.get(edge.from);
                const to = layout.positions.get(edge.to);

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
                    : statusConfig[fromStatus].edge;

                return (
                  <path
                    key={edgeKey(edge)}
                    d={edgePath(from, to)}
                    fill="none"
                    markerEnd="url(#graph-arrow-readable)"
                    opacity={critical || impacted ? 0.92 : 0.45}
                    stroke={stroke}
                    strokeDasharray={critical ? undefined : impacted ? "7 7" : undefined}
                    strokeLinecap="round"
                    strokeWidth={critical ? 3.5 : impacted ? 2.5 : 1.4}
                  />
                );
              })}
            </svg>

            {nodes.map((node) => {
              const position = layout.positions.get(node.id);

              if (!position) {
                return null;
              }

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
                  className={`absolute z-10 rounded-lg border p-3 text-left shadow-sm transition hover:border-[var(--status-pending)] hover:shadow-md ${config.border} ${config.bg} ${
                    selected ? "ring-2 ring-[var(--status-pending)]" : ""
                  } ${critical ? "shadow-[0_0_0_1px_var(--status-pending)]" : ""}`}
                  style={{
                    height: CARD_HEIGHT,
                    left: position.x,
                    top: position.y,
                    width: CARD_WIDTH,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon className={`h-4 w-4 shrink-0 ${config.text}`} />
                    <span className={`truncate text-[10px] font-semibold uppercase ${config.text}`}>
                      {config.label}
                    </span>
                  </div>
                  <div className="mt-2 line-clamp-2 min-h-9 text-sm font-semibold leading-tight text-[var(--foreground)]">
                    {node.label}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[var(--foreground-secondary)]">
                    <span className="truncate">{nodeTypeLabel(node.type)}</span>
                    <span className="shrink-0">{node.duration}m</span>
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
                          Impact
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
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
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <dt className="text-[var(--foreground-secondary)]">Depends on</dt>
                <dd className="text-[var(--foreground)]">{selectedDependencies?.incoming ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--foreground-secondary)]">Unlocks</dt>
                <dd className="text-[var(--foreground)]">{selectedDependencies?.outgoing ?? 0}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--foreground-secondary)]">
            Select a graph node to inspect status, dependencies, and downstream impact.
          </p>
        )}
      </aside>
    </div>
  );
}
