import { type ReleasePolicyPayload } from "@/lib/backend/model";
import { type FlowNode } from "@/lib/graphflow";

export type ReleasePolicy = Required<Omit<ReleasePolicyPayload, "tenantId" | "policyId" | "description">> & {
  tenantId: string;
  policyId: string;
  description?: string;
  source: "default" | "dynamodb";
};

export const defaultReleasePolicy: ReleasePolicy = {
  tenantId: "demo",
  policyId: "production-release-safety",
  name: "Production Release Safety Policy",
  description: "Default org-level policy for production release safety.",
  requiredNodeTypes: ["quality", "security", "approval", "deploy"],
  failOnNodeTypes: ["security", "deploy"],
  warnOnWaitingApproval: true,
  blockOnMigrationRisk: true,
  requireApprovalBeforeDeploy: true,
  source: "default",
};

export function normalizeReleasePolicy(input?: Partial<ReleasePolicyPayload> | null): ReleasePolicy {
  return {
    ...defaultReleasePolicy,
    ...input,
    tenantId: input?.tenantId ?? defaultReleasePolicy.tenantId,
    policyId: input?.policyId ?? defaultReleasePolicy.policyId,
    name: input?.name ?? defaultReleasePolicy.name,
    requiredNodeTypes: input?.requiredNodeTypes ?? defaultReleasePolicy.requiredNodeTypes,
    failOnNodeTypes: input?.failOnNodeTypes ?? defaultReleasePolicy.failOnNodeTypes,
    warnOnWaitingApproval: input?.warnOnWaitingApproval ?? defaultReleasePolicy.warnOnWaitingApproval,
    blockOnMigrationRisk: input?.blockOnMigrationRisk ?? defaultReleasePolicy.blockOnMigrationRisk,
    requireApprovalBeforeDeploy: input?.requireApprovalBeforeDeploy ?? defaultReleasePolicy.requireApprovalBeforeDeploy,
  };
}

export function policyRequiresNode(policy: ReleasePolicy, node: FlowNode) {
  return policy.requiredNodeTypes.includes(node.type);
}
