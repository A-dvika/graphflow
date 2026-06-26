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

        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold uppercase tracking-wide text-[var(--foreground-secondary)]">
              Critical path
            </span>
            {criticalPath.map((nodeId, index) => {
              const node = releaseMap.byId.get(nodeId);
              if (!node) return null;

              return (
                <span key={`${nodeId}-${index}`} className="inline-flex items-center gap-2">
                  {index > 0 && <ArrowRight className="h-3.5 w-3.5 text-[var(--foreground-secondary)]" />}
                  <button
                    onClick={() => onSelectNode?.(node.id)}
                    className="rounded border border-[var(--status-pending)]/50 bg-[var(--status-pending)]/10 px-2 py-1 text-[var(--status-pending)] transition hover:bg-[var(--status-pending)]/15"
                  >
                    {node.label}
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="flex min-w-max items-stretch gap-3">
            {releaseMap.stages.map((stage, stageIndex) => {
              const dependencies = uniqueEdges(bridgeEdges(releaseMap, stageIndex));

              return (
                <div key={stage.id} className="flex items-stretch gap-3">
                  <div className="w-64 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
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
                            className={`w-full rounded-lg border p-3 text-left transition hover:border-[var(--status-pending)] ${config.border} ${config.bg} ${
                              selected ? "ring-2 ring-[var(--status-pending)]" : ""
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
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]">
                        <ArrowRight className="h-4 w-4 text-[var(--status-pending)]" />
                      </div>
                      <div className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-center">
                        <p className="text-lg font-semibold text-[var(--foreground)]">{dependencies.length}</p>
                        <p className="text-[10px] uppercase text-[var(--foreground-secondary)]">links</p>
                      </div>
                      <div className="w-full space-y-1">
                        {dependencies.slice(0, 3).map((edge) => {
                          const critical = edgeInPath(edge, criticalPath);
                          const impacted = blastRadius.includes(edge.to);
                          return (
                            <div
                              key={edgeKey(edge)}
                              className={`h-1.5 rounded-full ${
                                critical
                                  ? "bg-[var(--status-pending)]"
                                  : impacted
                                    ? "bg-[var(--status-warning)]"
                                    : "bg-[var(--border)]"
                              }`}
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
                <dt className="text-[var(--foreground-secondary)]">Type</dt>
                <dd className="text-[var(--foreground)]">{nodeTypeLabel(selectedNode.type)}</dd>
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

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-secondary)]">
                Downstream
              </p>
              {selectedMeta.outgoing.length > 0 ? (
                selectedMeta.outgoing.map((edge) => (
                  <button
                    key={edgeKey(edge)}
                    onClick={() => onSelectNode?.(edge.to)}
                    className="flex w-full items-center justify-between gap-2 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-left text-xs text-[var(--foreground)] transition hover:border-[var(--status-pending)]"
                  >
                    <span className="truncate">{releaseMap.byId.get(edge.to)?.label ?? edge.to}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--foreground-secondary)]" />
                  </button>
                ))
              ) : (
                <p className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs text-[var(--foreground-secondary)]">
                  Final graph node.
                </p>
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
