import {
  downstreamOf,
  findCriticalPath,
  type FlowEdge,
  type FlowNode,
  type Status,
} from "@/lib/graphflow";

export type GateVerdict = "PASS" | "WARN" | "FAIL";

export type GateDecision = {
  verdict: GateVerdict;
  shouldBlock: boolean;
  summary: string;
  reasons: string[];
  failedNodes: string[];
  blockedNodes: string[];
  waitingNodes: string[];
  blastRadius: string[];
  requiredNodes: string[];
  criticalPath: ReturnType<typeof findCriticalPath>;
  policy: {
    failOnFailedOrBlocked: boolean;
    warnOnWaitingApproval: boolean;
    requiredNodeTypes: FlowNode["type"][];
  };
};

const requiredNodeTypes: FlowNode["type"][] = ["quality", "security", "approval", "deploy"];

export function graphNodesForGate(nodes: Array<Partial<FlowNode> & Pick<FlowNode, "id" | "label">>): FlowNode[] {
  return nodes.map((node, index) => ({
    id: node.id,
    label: node.label,
    type: node.type ?? "compute",
    duration: node.duration ?? 1,
    x: node.x ?? index * 10,
    y: node.y ?? 50,
  }));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function labelNodes(nodes: FlowNode[], ids: string[]) {
  const byId = new Map(nodes.map((node) => [node.id, node.label]));

  return ids.map((id) => byId.get(id) ?? id);
}

export function evaluateReleaseGate(input: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  statuses: Record<string, Status>;
  failOn?: GateVerdict;
}): GateDecision {
  const failOn = input.failOn ?? "FAIL";
  const statuses = Object.fromEntries(
    input.nodes.map((node) => [node.id, input.statuses[node.id] ?? "pending"]),
  ) as Record<string, Status>;
  const failedNodes = input.nodes.filter((node) => statuses[node.id] === "failed").map((node) => node.id);
  const blockedNodes = input.nodes.filter((node) => statuses[node.id] === "blocked").map((node) => node.id);
  const waitingNodes = input.nodes.filter((node) => statuses[node.id] === "waiting").map((node) => node.id);
  const requiredNodes = input.nodes
    .filter((node) => requiredNodeTypes.includes(node.type))
    .map((node) => node.id);
  const incompleteRequiredNodes = requiredNodes.filter((nodeId) => statuses[nodeId] !== "success");
  const impactedNodes = unique(
    failedNodes.flatMap((nodeId) => [...downstreamOf(nodeId, input.edges)]),
  );
  const reasons: string[] = [];

  if (failedNodes.length > 0) {
    reasons.push(`Failed nodes: ${labelNodes(input.nodes, failedNodes).join(", ")}.`);
  }

  if (blockedNodes.length > 0) {
    reasons.push(`Blocked downstream nodes: ${labelNodes(input.nodes, blockedNodes).join(", ")}.`);
  }

  if (waitingNodes.length > 0) {
    reasons.push(`Waiting approvals or gates: ${labelNodes(input.nodes, waitingNodes).join(", ")}.`);
  }

  if (incompleteRequiredNodes.length > 0) {
    reasons.push(`Required release checks not complete: ${labelNodes(input.nodes, incompleteRequiredNodes).join(", ")}.`);
  }

  let verdict: GateVerdict = "PASS";

  if (failedNodes.length > 0 || blockedNodes.length > 0) {
    verdict = "FAIL";
  } else if (waitingNodes.length > 0 || incompleteRequiredNodes.length > 0) {
    verdict = "WARN";
  }

  const shouldBlock = verdict === "FAIL" || (verdict === "WARN" && failOn === "WARN");
  const criticalPath = findCriticalPath(input.nodes, input.edges);

  return {
    verdict,
    shouldBlock,
    summary:
      verdict === "PASS"
        ? "Release gate passed. Required graph nodes are complete."
        : verdict === "FAIL"
          ? "Release gate failed. Production should not continue."
          : "Release gate warning. Required graph nodes are still waiting or incomplete.",
    reasons: reasons.length > 0 ? reasons : ["No active release risk detected."],
    failedNodes,
    blockedNodes,
    waitingNodes,
    blastRadius: impactedNodes,
    requiredNodes,
    criticalPath,
    policy: {
      failOnFailedOrBlocked: true,
      warnOnWaitingApproval: true,
      requiredNodeTypes,
    },
  };
}
