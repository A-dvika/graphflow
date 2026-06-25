import { NextResponse } from "next/server";
import { applyRunAction } from "@/lib/aws/dynamodb";
import { requireIngestAuth } from "@/lib/backend/auth";
import { buildRunIdentity } from "@/lib/backend/model";

export async function POST(request: Request) {
  const authError = requireIngestAuth(request);
  if (authError) {
    return authError;
  }

  const runId = `run_${Date.now()}`;
  const identity = buildRunIdentity({ runId });
  const run = await applyRunAction({
    identity,
    action: "start",
  });

  return NextResponse.json({
    ...run,
    runId,
    event: {
      source: "graphflow.release",
      detailType: "approval.waiting",
      detail: {
        runId,
      },
    },
    storage: {
      planned: "DynamoDB",
      table: "GraphFlowRuns",
      keys: {
        pk: `TENANT#${identity.tenantId}#PROJECT#${identity.projectId}#RUN#${identity.runId}`,
        sk: "NODE#build",
      },
    },
  });
}
