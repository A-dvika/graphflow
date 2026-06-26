import { NextResponse } from "next/server";
import { getRunFromDynamoDB } from "@/lib/aws/dynamodb";
import { getReleasePolicy } from "@/lib/aws/policies";
import { getWorkflowConfig } from "@/lib/aws/workflows";
import { requireIngestAuth } from "@/lib/backend/auth";
import { evaluateReleaseGate, graphNodesForGate, type GateVerdict } from "@/lib/backend/gate";
import { buildRunIdentity } from "@/lib/backend/model";

function parseFailOn(value: string | null): GateVerdict {
  return value === "WARN" || value === "PASS" || value === "FAIL" ? value : "FAIL";
}

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  const authError = requireIngestAuth(request);
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
  const [run, workflow, policy] = await Promise.all([
    getRunFromDynamoDB(identity),
    getWorkflowConfig(identity),
    getReleasePolicy({ tenantId: identity.tenantId }),
  ]);
  const graphNodes = graphNodesForGate(workflow.nodes);
  const decision = evaluateReleaseGate({
    nodes: graphNodes,
    edges: workflow.edges,
    statuses: run.statuses,
    failOn: parseFailOn(url.searchParams.get("failOn")),
    policy,
  });

  return NextResponse.json(
    {
      ok: !decision.shouldBlock,
      ...identity,
      gate: decision,
      policy,
      sources: {
        run: run.source,
        workflow: workflow.source,
      },
    },
    { status: decision.shouldBlock ? 409 : 200 },
  );
}
