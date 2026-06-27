import { NextResponse } from "next/server";
import { getAuditEventsFromAurora } from "@/lib/aws/aurora";
import { getRunFromDynamoDB } from "@/lib/aws/dynamodb";
import { getReleasePolicy } from "@/lib/aws/policies";
import { getWorkflowConfig } from "@/lib/aws/workflows";
import { requireIngestAuth } from "@/lib/backend/auth";
import { evaluateReleaseGate, graphNodesForGate } from "@/lib/backend/gate";
import { buildRunIdentity } from "@/lib/backend/model";

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const authError = await requireIngestAuth(request);
  if (authError) {
    return authError;
  }

  const { runId } = await context.params;
  const url = new URL(request.url);
  const identity = buildRunIdentity({
    tenantId: url.searchParams.get("tenantId") ?? undefined,
    projectId: url.searchParams.get("projectId") ?? undefined,
    projectPath: url.searchParams.get("projectPath") ?? undefined,
    workflowId: url.searchParams.get("workflowId") ?? undefined,
    runId,
  });
  const [run, workflow, policy, auditEvents] = await Promise.all([
    getRunFromDynamoDB(identity),
    getWorkflowConfig(identity),
    getReleasePolicy({ tenantId: identity.tenantId }),
    getAuditEventsFromAurora(identity),
  ]);
  const graphNodes = graphNodesForGate(workflow.nodes);
  const gate = evaluateReleaseGate({
    nodes: graphNodes,
    edges: workflow.edges,
    statuses: run.statuses,
    policy,
  });

  return NextResponse.json({
    artifactType: "graphflow.release-evidence.v1",
    generatedAt: new Date().toISOString(),
    ...identity,
    workflow: {
      ...workflow.workflow,
      source: workflow.source,
    },
    graph: {
      nodeCount: graphNodes.length,
      edgeCount: workflow.edges.length,
      criticalPath: gate.criticalPath,
    },
    gate,
    policy,
    run: {
      statuses: run.statuses,
      analysis: run.analysis,
      eventCount: run.events.length,
      source: run.source,
    },
    audit: {
      persistedInAurora: auditEvents.length > 0,
      events: auditEvents,
    },
    compliance: {
      soc2: {
        releaseApprovalEvidence: gate.requiredNodes.includes("approval") || graphNodes.some((node) => node.type === "approval"),
        changeManagementEvidence: auditEvents.length > 0 || run.events.length > 0,
        policyDecisionEvidence: true,
      },
      pci: {
        securityGateEvidence: graphNodes.some((node) => node.type === "security"),
        productionDeploymentControlled: graphNodes.some((node) => node.type === "deploy") && !gate.shouldBlock,
      },
    },
  });
}
