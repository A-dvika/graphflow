import { NextResponse } from "next/server";
import { putRunNodeState } from "@/lib/aws/dynamodb";
import { analyzeRun, initialStatuses, type Status } from "@/lib/graphflow";

export async function POST() {
  const runId = `run_${Date.now()}`;
  const statuses: Record<string, Status> = {
    ...initialStatuses,
    build: "running",
  };
  const write = await putRunNodeState({
    runId,
    nodeId: "build",
    status: "running",
    message: "Run started. Lambda worker picked up Build node.",
  });

  return NextResponse.json({
    runId,
    workflowId: "release-command-center",
    statuses,
    analysis: analyzeRun(statuses),
    event: {
      source: "graphflow.release",
      detailType: "node.started",
      detail: {
        runId,
        nodeId: "build",
      },
    },
    source: write.source,
    storage: {
      planned: "DynamoDB",
      table: "GraphFlowRuns",
      keys: {
        pk: runId,
        sk: "NODE#build",
      },
    },
  });
}
