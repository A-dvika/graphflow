"use client";

import React, { useMemo } from "react";
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

type Stage = {
  id: number;
  label: string;
  nodes: FlowNode[];
};

type NodeMeta = {
  incoming: FlowEdge[];
  outgoing: FlowEdge[];
  stage: number;
};

type ReleaseMap = {
  byId: Map<string, FlowNode>;
  meta: Map<string, NodeMeta>;
  stages: Stage[];
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

function stageLabel(nodes: FlowNode[]) {
  const types = new Set(nodes.map((node) => node.type));

  if (types.has("approval")) return "Approval";
  if (types.has("deploy")) return "Deploy";
  if (types.has("security")) return "Risk checks";
  if (types.has("quality")) return "Validation";
  return "Build";
}

function buildReleaseMap(nodes: FlowNode[], edges: FlowEdge[]): ReleaseMap {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const validEdges = edges.filter((edge) => byId.has(edge.from) && byId.has(edge.to));
  const incoming = new Map(nodes.map((node) => [node.id, [] as FlowEdge[]]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as FlowEdge[]]));

  for (const edge of validEdges) {
    outgoing.get(edge.from)?.push(edge);
    incoming.get(edge.to)?.push(edge);
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

  const stageNumbers = [...new Set(nodes.map((node) => levels.get(node.id) ?? 0))].sort((a, b) => a - b);
  const stages = stageNumbers.map((stage) => {
    const stageNodes = nodes
      .filter((node) => (levels.get(node.id) ?? 0) === stage)
      .sort((a, b) => a.y - b.y || a.x - b.x || a.label.localeCompare(b.label));

    return {
      id: stage,
      label: stageLabel(stageNodes),
      nodes: stageNodes,
    };
  });
  const stageByOriginalLevel = new Map(stageNumbers.map((stage, index) => [stage, index]));
  const meta = new Map<string, NodeMeta>();

  nodes.forEach((node) => {
    meta.set(node.id, {
      incoming: incoming.get(node.id) ?? [],
      outgoing: outgoing.get(node.id) ?? [],
      stage: stageByOriginalLevel.get(levels.get(node.id) ?? 0) ?? 0,
    });
  });

  return { byId, meta, stages };
}

function bridgeEdges(map: ReleaseMap, stageIndex: number) {
  return [...map.meta.entries()]
    .flatMap(([, meta]) => meta.outgoing)
    .filter((edge) => {
      const fromStage = map.meta.get(edge.from)?.stage ?? 0;
      const toStage = map.meta.get(edge.to)?.stage ?? 0;
      return fromStage <= stageIndex && toStage > stageIndex;
    });
}

function uniqueEdges(edges: FlowEdge[]) {
  return [...new Map(edges.map((edge) => [edgeKey(edge), edge])).values()];
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

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Release Dependency Graph</h3>
            <p className="text-sm text-[var(--foreground-secondary)]">
              Pipeline stages, dependency bridges, and release-gate impact in one readable map.
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

        <div className="mb-4 rounded-lg border border-[var(--status-pending)]/30 bg-gradient-to-r from-[var(--status-pending)]/5 to-[var(--background)] p-4 shadow-md">
          <div className="flex flex-col gap-3">
            <p className="font-bold uppercase tracking-wide text-[var(--status-pending)] text-sm">
              Critical Path
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {criticalPath.length > 0 ? (
                criticalPath.map((nodeId, index) => {
                  const node = releaseMap.byId.get(nodeId);
                  if (!node) return null;

                  return (
                    <span key={`${nodeId}-${index}`} className="inline-flex items-center gap-2">
                      {index > 0 && <ArrowRight className="h-4 w-4 text-[var(--status-pending)]" />}
                      <button
                        onClick={() => onSelectNode?.(node.id)}
                        className="rounded-lg border-2 border-[var(--status-pending)] bg-[var(--status-pending)]/10 hover:bg-[var(--status-pending)]/20 px-3 py-1.5 text-[var(--status-pending)] transition-all duration-200 font-semibold hover:shadow-md"
                      >
                        {node.label}
                      </button>
                    </span>
                  );
                })
              ) : (
                <p className="text-[var(--foreground-secondary)]">No critical path calculated yet</p>
              )}
            </div>
            <p className="text-[10px] text-[var(--foreground-secondary)] mt-1">
              {criticalPath.length} nodes on critical path · {criticalPath.reduce((sum, nodeId) => sum + (releaseMap.byId.get(nodeId)?.duration ?? 0), 0)}m total duration
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 shadow-lg">
          <div className="flex min-w-max items-stretch gap-4">
            {releaseMap.stages.map((stage, stageIndex) => {
              const dependencies = uniqueEdges(bridgeEdges(releaseMap, stageIndex));

              return (
                <div key={stage.id} className="flex items-stretch gap-3">
                  <div className="w-64 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-md hover:shadow-lg transition-shadow">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground-secondary)]">
                          Stage {stageIndex + 1}
                        </p>
                        <h4 className="mt-1 text-sm font-semibold text-[var(--foreground)]">{stage.label}</h4>
                      </div>
                      <span className="rounded border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--foreground-secondary)]">
                        {stage.nodes.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {stage.nodes.map((node) => {
                        const status = statuses[node.id] ?? "pending";
                        const config = statusConfig[status];
                        const Icon = config.icon;
                        const critical = criticalPath.includes(node.id);
                        const impacted = blastRadius.includes(node.id);
                        const selected = selectedNodeId === node.id;
                        const meta = releaseMap.meta.get(node.id);

                        return (
                          <button
                            key={node.id}
                            onClick={() => onSelectNode?.(node.id)}
                            className={`w-full rounded-lg border p-3 text-left transition-all duration-200 hover:border-[var(--status-pending)] hover:shadow-md ${config.border} ${config.bg} ${
                              selected ? "ring-2 ring-[var(--status-pending)] shadow-lg" : "hover:-translate-y-0.5"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <Icon className={`h-4 w-4 shrink-0 ${config.text}`} />
                                  <span className={`text-[10px] font-semibold uppercase ${config.text}`}>
                                    {config.label}
                                  </span>
                                </div>
                                <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-[var(--foreground)]">
                                  {node.label}
                                </p>
                              </div>
                              <span className="shrink-0 text-[10px] text-[var(--foreground-secondary)]">
                                {node.duration}m
                              </span>
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

                  {stageIndex < releaseMap.stages.length - 1 && (
                    <div className="flex w-28 shrink-0 flex-col items-center justify-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--status-pending)] bg-[var(--status-pending)]/10 shadow-md hover:shadow-lg transition-shadow">
                        <ArrowRight className="h-5 w-5 text-[var(--status-pending)]" />
                      </div>
                      <div className="w-full rounded-lg border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--background)] p-3 text-center hover:shadow-md transition-shadow">
                        <p className="text-lg font-bold text-[var(--status-pending)]">{dependencies.length}</p>
                        <p className="text-[10px] uppercase font-semibold text-[var(--foreground-secondary)]">links</p>
                      </div>
                      <div className="w-full space-y-1.5">
                        {dependencies.slice(0, 3).map((edge, idx) => {
                          const critical = edgeInPath(edge, criticalPath);
                          const impacted = blastRadius.includes(edge.to);
                          return (
                            <div
                              key={edgeKey(edge)}
                              className={`h-2 rounded-full transition-all ${
                                critical
                                  ? "bg-[var(--status-pending)] shadow-sm"
                                  : impacted
                                    ? "bg-[var(--status-warning)]"
                                    : "bg-[var(--border)]"
                              }`}
                              style={{
                                animation: critical ? `pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite` : 'none',
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--status-pending)]/10">
            <GitBranch className="h-4 w-4 text-[var(--status-pending)]" />
          </div>
          Selected Node Details
        </div>
        {selectedNode && selectedMeta ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--foreground-secondary)]">Node</p>
              <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{selectedNode.label}</p>
            </div>
            <dl className="space-y-2 text-sm mt-4">
              <div className="flex items-center justify-between rounded-lg bg-[var(--background)] p-3 border border-[var(--border)]">
                <dt className="text-[var(--foreground-secondary)] font-medium">Status</dt>
                <dd className={`flex items-center gap-2 font-semibold ${statusConfig[statuses[selectedNode.id] ?? "pending"].text}`}>
                  {React.createElement(statusConfig[statuses[selectedNode.id] ?? "pending"].icon, { className: "w-4 h-4" })}
                  {statusConfig[statuses[selectedNode.id] ?? "pending"].label}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--background)] p-3 border border-[var(--border)]">
                <dt className="text-[var(--foreground-secondary)] font-medium">Type</dt>
                <dd className="text-[var(--foreground)] font-semibold px-2 py-1 rounded bg-[var(--surface)] border border-[var(--border)]">{nodeTypeLabel(selectedNode.type)}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--background)] p-3 border border-[var(--border)]">
                <dt className="text-[var(--foreground-secondary)] font-medium">Duration</dt>
                <dd className="text-[var(--foreground)] font-semibold">{selectedNode.duration}m</dd>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="rounded-lg bg-[var(--background)] p-3 border border-[var(--status-pending)]/30">
                  <p className="text-[10px] uppercase text-[var(--foreground-secondary)] font-bold">Dependencies</p>
                  <p className="text-2xl font-bold text-[var(--status-pending)] mt-1">{selectedMeta.incoming.length}</p>
                </div>
                <div className="rounded-lg bg-[var(--background)] p-3 border border-[var(--status-success)]/30">
                  <p className="text-[10px] uppercase text-[var(--foreground-secondary)] font-bold">Unlocks</p>
                  <p className="text-2xl font-bold text-[var(--status-success)] mt-1">{selectedMeta.outgoing.length}</p>
                </div>
              </div>
            </dl>

            <div className="space-y-2 mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--foreground-secondary)]">
                Downstream Impact
              </p>
              {selectedMeta.outgoing.length > 0 ? (
                <div className="space-y-2">
                  {selectedMeta.outgoing.map((edge) => (
                    <button
                      key={edgeKey(edge)}
                      onClick={() => onSelectNode?.(edge.to)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--status-pending)]/30 bg-[var(--status-pending)]/5 hover:bg-[var(--status-pending)]/10 px-3 py-2 text-left text-xs text-[var(--foreground)] transition-all duration-200 hover:border-[var(--status-pending)] group"
                    >
                      <span className="truncate font-medium">{releaseMap.byId.get(edge.to)?.label ?? edge.to}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--foreground-secondary)] group-hover:text-[var(--status-pending)] transition-colors" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-xs text-[var(--foreground-secondary)]">
                  <p className="font-medium">No downstream nodes</p>
                  <p className="mt-1 opacity-75">This is a final graph node.</p>
                </div>
              )}
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
