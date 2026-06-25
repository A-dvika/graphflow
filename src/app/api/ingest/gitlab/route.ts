import { NextResponse } from "next/server";
import { putRunNodeState } from "@/lib/aws/dynamodb";
import { downstreamOf, type Status } from "@/lib/graphflow";

type GitLabIngestPayload = {
  runId?: string;
  pipelineId?: string;
  workflowId?: string;
  nodeId?: string;
  status?: Status;
  message?: string;
};

function isStatus(value: unknown): value is Status {
  return (
    value === "pending" ||
    value === "running" ||
    value === "success" ||
    value === "failed" ||
    value === "blocked" ||
    value === "waiting"
  );
}

export async function POST(request: Request) {
  const payload = (await request.json()) as GitLabIngestPayload;
  const runId = payload.runId ?? (payload.pipelineId ? `gitlab_${payload.pipelineId}` : `run_${Date.now()}`);
  const nodeId = payload.nodeId ?? "build";
  const status = isStatus(payload.status) ? payload.status : "running";
  const message = payload.message ?? `GitLab reported ${nodeId} as ${status}.`;

  const write = await putRunNodeState({
    runId,
    workflowId: payload.workflowId,
    nodeId,
    status,
    message,
  });

  const blockedByFailure =
    status === "failed"
      ? [...downstreamOf(nodeId)].map((blockedNodeId) =>
          putRunNodeState({
            runId,
            workflowId: payload.workflowId,
            nodeId: blockedNodeId,
            status: "blocked",
            message: `Blocked by failed upstream node: ${nodeId}.`,
          }),
        )
      : [];

  await Promise.all(blockedByFailure);

  return NextResponse.json({
    ok: true,
    runId,
    nodeId,
    status,
    source: write.source,
    blockedNodesWritten: blockedByFailure.length,
  });
}
