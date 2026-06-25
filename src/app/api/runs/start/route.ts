import { NextResponse } from "next/server";
import { analyzeRun, initialStatuses, type Status } from "@/lib/graphflow";

export async function POST() {
  const runId = `run_${Date.now()}`;
  const statuses: Record<string, Status> = {
    ...initialStatuses,
    build: "running",
  };

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
