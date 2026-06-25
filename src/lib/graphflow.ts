export type Status = "pending" | "running" | "success" | "failed" | "blocked" | "waiting";

export type FlowNode = {
  id: string;
  label: string;
  type: "compute" | "quality" | "security" | "approval" | "deploy";
  duration: number;
  x: number;
  y: number;
};

export type FlowEdge = {
  from: string;
  to: string;
};

export const releaseNodes: FlowNode[] = [
  { id: "build", label: "Build", type: "compute", duration: 4, x: 8, y: 40 },
  { id: "unit", label: "Unit Tests", type: "quality", duration: 7, x: 25, y: 18 },
  { id: "scan", label: "Security Scan", type: "security", duration: 9, x: 25, y: 62 },
  { id: "approval", label: "Release Approval", type: "approval", duration: 12, x: 48, y: 40 },
  { id: "staging", label: "Deploy Staging", type: "deploy", duration: 6, x: 68, y: 25 },
  { id: "smoke", label: "Smoke Test", type: "quality", duration: 5, x: 68, y: 58 },
  { id: "prod", label: "Deploy Production", type: "deploy", duration: 8, x: 88, y: 40 },
];

export const releaseEdges: FlowEdge[] = [
  { from: "build", to: "unit" },
  { from: "build", to: "scan" },
  { from: "unit", to: "approval" },
  { from: "scan", to: "approval" },
  { from: "approval", to: "staging" },
  { from: "approval", to: "smoke" },
  { from: "staging", to: "prod" },
  { from: "smoke", to: "prod" },
];

export const initialStatuses = Object.fromEntries(
  releaseNodes.map((node) => [node.id, "pending"]),
) as Record<string, Status>;

export function findCriticalPath(nodes = releaseNodes, edges = releaseEdges) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, [] as string[]]));

  for (const edge of edges) {
    incoming.get(edge.to)?.push(edge.from);
  }

  const score = new Map<string, number>();
  const previous = new Map<string, string>();

  for (const node of nodes) {
    const parents = incoming.get(node.id) ?? [];
    const bestParent = parents
      .map((parentId) => ({
        id: parentId,
        score: score.get(parentId) ?? byId.get(parentId)!.duration,
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (bestParent) {
      score.set(node.id, bestParent.score + node.duration);
      previous.set(node.id, bestParent.id);
    } else {
      score.set(node.id, node.duration);
    }
  }

  const end = [...score.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const path = [end];
  let cursor = end;

  while (previous.has(cursor)) {
    cursor = previous.get(cursor)!;
    path.unshift(cursor);
  }

  return { path, minutes: score.get(end) ?? 0 };
}

export function downstreamOf(nodeId: string, edges = releaseEdges) {
  const result = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges.filter((item) => item.from === current)) {
      if (!result.has(edge.to)) {
        result.add(edge.to);
        queue.push(edge.to);
      }
    }
  }

  return result;
}

export function analyzeRun(statuses: Record<string, Status>) {
  const criticalPath = findCriticalPath();
  const blockedNodes = releaseNodes.filter((node) => statuses[node.id] === "blocked");
  const waitingNode = releaseNodes.find((node) => statuses[node.id] === "waiting");
  const failedNode = releaseNodes.find((node) => statuses[node.id] === "failed");

  return {
    criticalPath,
    blockedCount: blockedNodes.length,
    completedCount: Object.values(statuses).filter((status) => status === "success").length,
    bottleneck: failedNode?.label ?? waitingNode?.label ?? null,
    recommendation: failedNode
      ? `Fix ${failedNode.label}; ${blockedNodes.length} downstream nodes are blocked.`
      : waitingNode
        ? `Approve ${waitingNode.label} to unlock deployment branches.`
        : "No active blocker detected.",
  };
}
