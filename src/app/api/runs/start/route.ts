import { NextResponse } from "next/server";
import { applyRunAction } from "@/lib/aws/dynamodb";

export async function POST() {
  const runId = `run_${Date.now()}`;
  const run = await applyRunAction({
    runId,
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
        pk: runId,
        sk: "NODE#build",
      },
    },
  });
}
