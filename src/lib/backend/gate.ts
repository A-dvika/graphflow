import {
  downstreamOf,
  findCriticalPath,
  type FlowEdge,
  type FlowNode,
  type Status,
} from "@/lib/graphflow";
import { analyzeMigrationRisk, type MigrationRisk } from "@/lib/backend/migration-risk";
import { defaultReleasePolicy, policyRequiresNode, type ReleasePolicy } from "@/lib/backend/policy";

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
  migrationRisk: MigrationRisk;
  policy: {
    id: string;
    name: string;
    failOnFailedOrBlocked: boolean;
    warnOnWaitingApproval: boolean;
    requiredNodeTypes: FlowNode["type"][];
    failOnNodeTypes: FlowNode["type"][];
    blockOnMigrationRisk: boolean;
    requireApprovalBeforeDeploy: boolean;
  };
};

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
  policy?: ReleasePolicy;
}): GateDecision {
  const failOn = input.failOn ?? "FAIL";
  const policy = input.policy ?? defaultReleasePolicy;
  const statuses = Object.fromEntries(
    input.nodes.map((node) => [node.id, input.statuses[node.id] ?? "pending"]),
  ) as Record<string, Status>;
  const failedNodes = input.nodes.filter((node) => statuses[node.id] === "failed").map((node) => node.id);
  const blockedNodes = input.nodes.filter((node) => statuses[node.id] === "blocked").map((node) => node.id);
  const waitingNodes = input.nodes.filter((node) => statuses[node.id] === "waiting").map((node) => node.id);
  const requiredNodes = input.nodes
    .filter((node) => policyRequiresNode(policy, node))
    .map((node) => node.id);
  const incompleteRequiredNodes = requiredNodes.filter((nodeId) => statuses[nodeId] !== "success");
  const failedPolicyNodes = input.nodes
    .filter((node) => statuses[node.id] === "failed" && policy.failOnNodeTypes.includes(node.type))
    .map((node) => node.id);
  const impactedNodes = unique(
    failedNodes.flatMap((nodeId) => [...downstreamOf(nodeId, input.edges)]),
  );
  const migrationRisk = analyzeMigrationRisk({
    nodes: input.nodes,
    statuses,
  });
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

  if (failedPolicyNodes.length > 0) {
    reasons.push(`Org policy marks these failed node types as production-blocking: ${labelNodes(input.nodes, failedPolicyNodes).join(", ")}.`);
  }

  if (policy.blockOnMigrationRisk && migrationRisk.level === "high") {
    reasons.push(migrationRisk.summary);
  }

  if (policy.requireApprovalBeforeDeploy) {
    const approvalNodes = input.nodes.filter((node) => node.type === "approval");
    const deployNodes = input.nodes.filter((node) => node.type === "deploy");
    const hasSuccessfulDeploy = deployNodes.some((node) => statuses[node.id] === "success");
    const hasApproval = approvalNodes.length === 0 || approvalNodes.some((node) => statuses[node.id] === "success");

    if (hasSuccessfulDeploy && !hasApproval) {
      reasons.push("Org policy requires approval evidence before deploy nodes can be accepted.");
    }
  }

  let verdict: GateVerdict = "PASS";

  if (
    failedNodes.length > 0 ||
    blockedNodes.length > 0 ||
    failedPolicyNodes.length > 0 ||
    (policy.blockOnMigrationRisk && migrationRisk.level === "high")
  ) {
    verdict = "FAIL";
  } else if (
    (policy.warnOnWaitingApproval && waitingNodes.length > 0) ||
    incompleteRequiredNodes.length > 0 ||
    (policy.blockOnMigrationRisk && migrationRisk.level === "medium")
  ) {
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
    migrationRisk,
    policy: {
      id: policy.policyId,
      name: policy.name,
      failOnFailedOrBlocked: true,
      warnOnWaitingApproval: policy.warnOnWaitingApproval,
      requiredNodeTypes: policy.requiredNodeTypes,
      failOnNodeTypes: policy.failOnNodeTypes,
      blockOnMigrationRisk: policy.blockOnMigrationRisk,
      requireApprovalBeforeDeploy: policy.requireApprovalBeforeDeploy,
    },
  };
}
