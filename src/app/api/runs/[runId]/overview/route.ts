import { NextResponse } from "next/server";
import { generateReleaseInsight } from "@/lib/agent/release-agent";
import { getRunFromDynamoDB } from "@/lib/aws/dynamodb";
import { getWorkflowConfig } from "@/lib/aws/workflows";
import { evaluateReleaseGate, graphNodesForGate } from "@/lib/backend/gate";
import { buildRunIdentity } from "@/lib/backend/model";

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const url = new URL(request.url);
  const identity = buildRunIdentity({
    tenantId: url.searchParams.get("tenantId") ?? undefined,
    projectId: url.searchParams.get("projectId") ?? undefined,
    projectPath: url.searchParams.get("projectPath") ?? undefined,
    workflowId: url.searchParams.get("workflowId") ?? undefined,
    runId,
  });
  const [run, workflow] = await Promise.all([
    getRunFromDynamoDB(identity),
    getWorkflowConfig(identity),
  ]);
  const graphNodes = graphNodesForGate(workflow.nodes);
  const gate = evaluateReleaseGate({
    nodes: graphNodes,
    edges: workflow.edges,
    statuses: run.statuses,
  });
  const insight = await generateReleaseInsight({
    runId: identity.runId,
    workflowId: identity.workflowId,
    nodes: graphNodes,
    edges: workflow.edges,
    statuses: run.statuses,
    gate,
  });

  return NextResponse.json({
    ok: true,
    ...identity,
    run,
    workflow: {
      ...workflow.workflow,
      source: workflow.source,
    },
    graph: {
      nodes: graphNodes,
      edges: workflow.edges,
    },
    gate,
    insight,
    sources: {
      run: run.source,
      workflow: workflow.source,
    },
  });
}
