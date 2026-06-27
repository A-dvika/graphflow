"use client";

import { useMemo } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  GitBranch,
  Lock,
  RadioTower,
} from "lucide-react";
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
  stageIndex: number;
  x: number;
  y: number;
};

type Stage = {
  id: number;
  label: string;
  nodes: PositionedNode[];
  x: number;
};

type NodeMeta = {
  incoming: FlowEdge[];
  outgoing: FlowEdge[];
  stageIndex: number;
};

type ReleaseMap = {
  byId: Map<string, PositionedNode>;
  height: number;
  meta: Map<string, NodeMeta>;
  stages: Stage[];
  width: number;
};

const CARD_WIDTH = 220;
const CARD_HEIGHT = 116;
const COLUMN_STEP = 330;
const ROW_STEP = 148;
const PADDING_X = 42;
const PADDING_TOP = 84;
const PADDING_BOTTOM = 48;

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

function buildReleaseMap(nodes: FlowNode[], edges: FlowEdge[]): ReleaseMap {
  const rawById = new Map(nodes.map((node) => [node.id, node]));
  const validEdges = edges.filter((edge) => rawById.has(edge.from) && rawById.has(edge.to));
  const incoming = new Map(nodes.map((node) => [node.id, [] as FlowEdge[]]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as FlowEdge[]]));

  for (const edge of validEdges) {
    incoming.get(edge.to)?.push(edge);
    outgoing.get(edge.from)?.push(edge);
  }

  const indegree = new Map(nodes.map((node) => [node.id, incoming.get(node.id)?.length ?? 0]));
  const levels = new Map(nodes.map((node) => [node.id, 0]));
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    visited.add(current);

    for (const edge of outgoing.get(current) ?? []) {
      levels.set(edge.to, Math.max(levels.get(edge.to) ?? 0, (levels.get(current) ?? 0) + 1));
      const nextDegree = (indegree.get(edge.to) ?? 0) - 1;
      indegree.set(edge.to, nextDegree);

      if (nextDegree === 0) {
        queue.push(edge.to);
      }
    }
  }

  nodes.forEach((node, index) => {
    if (!visited.has(node.id)) {
      levels.set(node.id, Math.floor(index / 2));
    }
  });

  const stageIds = [...new Set(nodes.map((node) => levels.get(node.id) ?? 0))].sort((a, b) => a - b);
  const stageIndexById = new Map(stageIds.map((stageId, index) => [stageId, index]));
  const groupedNodes = stageIds.map((stageId) =>
    nodes
      .filter((node) => (levels.get(node.id) ?? 0) === stageId)
      .sort((a, b) => a.y - b.y || a.x - b.x || a.label.localeCompare(b.label)),
  );
  const maxRows = Math.max(1, ...groupedNodes.map((group) => group.length));
  const height = Math.max(470, PADDING_TOP + PADDING_BOTTOM + CARD_HEIGHT + Math.max(0, maxRows - 1) * ROW_STEP);
  const width = Math.max(980, PADDING_X * 2 + CARD_WIDTH + Math.max(0, stageIds.length - 1) * COLUMN_STEP);
  const byId = new Map<string, PositionedNode>();
  const stages = groupedNodes.map((group, stageIndex) => {
    const stageX = PADDING_X + stageIndex * COLUMN_STEP;
    const groupHeight = CARD_HEIGHT + Math.max(0, group.length - 1) * ROW_STEP;
    const available = height - PADDING_TOP - PADDING_BOTTOM;
    const offsetY = Math.max(0, (available - groupHeight) / 2);
    const positioned = group.map((node, rowIndex) => {
      const positionedNode = {
        ...node,
        stageIndex,
        x: stageX,
        y: PADDING_TOP + offsetY + rowIndex * ROW_STEP,
      };

      byId.set(node.id, positionedNode);
      return positionedNode;
    });

    return {
      id: stageIds[stageIndex],
      label: stageLabel(group),
      nodes: positioned,
      x: stageX,
    };
  });
  const meta = new Map<string, NodeMeta>();

  nodes.forEach((node) => {
    meta.set(node.id, {
      incoming: incoming.get(node.id) ?? [],
      outgoing: outgoing.get(node.id) ?? [],
      stageIndex: stageIndexById.get(levels.get(node.id) ?? 0) ?? 0,
    });
  });

  return { byId, height, meta, stages, width };
}

function selectedTouches(edge: FlowEdge, selectedNodeId?: string | null) {
  return Boolean(selectedNodeId && (edge.from === selectedNodeId || edge.to === selectedNodeId));
}

function edgePath(edge: FlowEdge, map: ReleaseMap, edgeIndex: number) {
  const from = map.byId.get(edge.from);
  const to = map.byId.get(edge.to);

  if (!from || !to) {
    return null;
  }

  const startX = from.x + CARD_WIDTH;
  const startY = from.y + CARD_HEIGHT / 2;
  const endX = to.x;
  const endY = to.y + CARD_HEIGHT / 2;
  const laneOffset = ((edgeIndex % 4) - 1.5) * 8;
  const busX = Math.min(endX - 28, startX + Math.max(58, (endX - startX) * 0.48) + laneOffset);

  return `M ${startX} ${startY} L ${busX} ${startY} L ${busX} ${endY} L ${endX} ${endY}`;
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
  const releaseMap = useMemo(() => buildReleaseMap(nodes, edges), [nodes, edges]);
  const selectedNode = selectedNodeId ? releaseMap.byId.get(selectedNodeId) : null;
  const selectedMeta = selectedNode ? releaseMap.meta.get(selectedNode.id) : null;
  const criticalEdges = edges.filter((edge) => edgeInPath(edge, criticalPath)).length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Release Dependency Graph</h3>
            <p className="text-sm text-[var(--foreground-secondary)]">
              A stage-aligned dependency map with critical route and blocked impact highlighted.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded border border-[var(--border)] px-2 py-1 text-[var(--foreground-secondary)]">
              {nodes.length} nodes
            </span>
            <span className="rounded border border-[var(--border)] px-2 py-1 text-[var(--foreground-secondary)]">
              {edges.length} links
            </span>
            <span className="rounded border border-[var(--status-pending)] px-2 py-1 text-[var(--status-pending)]">
              Critical route: {criticalEdges} links
            </span>
          </div>
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_260px]">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold uppercase tracking-wide text-[var(--foreground-secondary)]">
                Critical route
              </span>
              {criticalPath.map((nodeId, index) => {
                const node = releaseMap.byId.get(nodeId);
                if (!node) return null;

                return (
                  <span key={`${nodeId}-${index}`} className="inline-flex items-center gap-2">
                    {index > 0 && <ArrowRight className="h-3.5 w-3.5 text-[var(--foreground-secondary)]" />}
                    <button
                      onClick={() => onSelectNode?.(node.id)}
                      className="max-w-40 truncate rounded border border-[var(--status-pending)]/50 bg-[var(--status-pending)]/10 px-2 py-1 text-[var(--status-pending)] transition hover:bg-[var(--status-pending)]/15"
                    >
                      {node.label}
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">{releaseMap.stages.length}</p>
                <p className="text-[10px] uppercase text-[var(--foreground-secondary)]">Stages</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--status-warning)]">{blastRadius.length}</p>
                <p className="text-[10px] uppercase text-[var(--foreground-secondary)]">Impacted</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--status-pending)]">{criticalPath.length}</p>
                <p className="text-[10px] uppercase text-[var(--foreground-secondary)]">Route</p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)]">
          <div
            className="relative"
            style={{
              height: releaseMap.height,
              minWidth: releaseMap.width,
            }}
          >
            <div className="absolute inset-0">
              {releaseMap.stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className="absolute top-0 h-full border-l border-[var(--border)]/70"
                  style={{ left: Math.max(0, stage.x - 18), width: CARD_WIDTH + 36 }}
                >
                  <div className="mt-4 flex items-center justify-between px-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-secondary)]">
                        Stage {index + 1}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{stage.label}</p>
                    </div>
                    <span className="rounded border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--foreground-secondary)]">
                      {stage.nodes.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <svg
              aria-hidden="true"
              className="absolute inset-0 z-0"
              height={releaseMap.height}
              viewBox={`0 0 ${releaseMap.width} ${releaseMap.height}`}
              width={releaseMap.width}
            >
              <defs>
                <marker id="release-graph-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                  <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />
                </marker>
              </defs>
              {edges.map((edge, index) => {
                const path = edgePath(edge, releaseMap, index);

                if (!path) {
                  return null;
                }

                const fromStatus = statuses[edge.from] ?? "pending";
                const critical = edgeInPath(edge, criticalPath);
                const impacted = blastRadius.includes(edge.to);
                const touched = selectedTouches(edge, selectedNodeId);
                const stroke = critical
                  ? "var(--status-pending)"
                  : impacted
                    ? "var(--status-warning)"
                    : statusConfig[fromStatus].edge;

                return (
                  <path
                    key={edgeKey(edge)}
                    d={path}
                    fill="none"
                    markerEnd="url(#release-graph-arrow)"
                    opacity={selectedNodeId ? (touched ? 1 : 0.18) : critical || impacted ? 0.92 : 0.42}
                    stroke={stroke}
                    strokeDasharray={critical ? undefined : impacted ? "7 7" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={touched || critical ? 3.2 : impacted ? 2.4 : 1.5}
                  />
                );
              })}
            </svg>

            {nodes.map((node) => {
              const positioned = releaseMap.byId.get(node.id);

              if (!positioned) {
                return null;
              }

              const status = statuses[node.id] ?? "pending";
              const config = statusConfig[status];
              const Icon = config.icon;
              const critical = criticalPath.includes(node.id);
              const impacted = blastRadius.includes(node.id);
              const selected = selectedNodeId === node.id;
              const dimmed = Boolean(selectedNodeId && !selected && !(selectedMeta?.incoming.some((edge) => edge.from === node.id) || selectedMeta?.outgoing.some((edge) => edge.to === node.id)));
              const meta = releaseMap.meta.get(node.id);

              return (
                <button
                  key={node.id}
                  onClick={() => onSelectNode?.(node.id)}
                  className={`absolute z-10 rounded-lg border p-3 text-left shadow-sm transition hover:border-[var(--status-pending)] hover:shadow-md ${config.border} ${config.bg} ${
                    selected ? "ring-2 ring-[var(--status-pending)]" : ""
                  } ${dimmed ? "opacity-45" : "opacity-100"}`}
                  style={{
                    height: CARD_HEIGHT,
                    left: positioned.x,
                    top: positioned.y,
                    width: CARD_WIDTH,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 shrink-0 ${config.text}`} />
                        <span className={`text-[10px] font-semibold uppercase ${config.text}`}>{config.label}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-[var(--foreground)]">
                        {node.label}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-[var(--foreground-secondary)]">{node.duration}m</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-[var(--foreground-secondary)]">
                      {nodeTypeLabel(node.type)}
                    </span>
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

                  <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2 text-[10px] text-[var(--foreground-secondary)]">
                    <span>{meta?.incoming.length ?? 0} in</span>
                    <span>{meta?.outgoing.length ?? 0} out</span>
                  </div>
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
        {selectedNode && selectedMeta ? (
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
                <dt className="text-[var(--foreground-secondary)]">Stage</dt>
                <dd className="text-[var(--foreground)]">{selectedMeta.stageIndex + 1}</dd>
              </div>
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <dt className="text-[var(--foreground-secondary)]">Duration</dt>
                <dd className="text-[var(--foreground)]">{selectedNode.duration}m</dd>
              </div>
              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <dt className="text-[var(--foreground-secondary)]">Depends on</dt>
                <dd className="text-[var(--foreground)]">{selectedMeta.incoming.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--foreground-secondary)]">Unlocks</dt>
                <dd className="text-[var(--foreground)]">{selectedMeta.outgoing.length}</dd>
              </div>
            </dl>

            <div className="grid gap-3">
              <DependencyList
                edges={selectedMeta.incoming}
                label="Upstream"
                nodes={releaseMap.byId}
                onSelectNode={onSelectNode}
                target="from"
              />
              <DependencyList
                edges={selectedMeta.outgoing}
                label="Downstream"
                nodes={releaseMap.byId}
                onSelectNode={onSelectNode}
                target="to"
              />
            </div>
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

function DependencyList({
  edges,
  label,
  nodes,
  onSelectNode,
  target,
}: {
  edges: FlowEdge[];
  label: string;
  nodes: Map<string, PositionedNode>;
  onSelectNode?: (nodeId: string) => void;
  target: "from" | "to";
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-secondary)]">{label}</p>
      {edges.length > 0 ? (
        edges.map((edge) => {
          const nodeId = edge[target];
          return (
            <button
              key={`${label}-${edgeKey(edge)}`}
              onClick={() => onSelectNode?.(nodeId)}
              className="flex w-full items-center justify-between gap-2 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-left text-xs text-[var(--foreground)] transition hover:border-[var(--status-pending)]"
            >
              <span className="truncate">{nodes.get(nodeId)?.label ?? nodeId}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--foreground-secondary)]" />
            </button>
          );
        })
      ) : (
        <p className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs text-[var(--foreground-secondary)]">
          None
        </p>
      )}
    </div>
  );
}
