import { NextResponse } from "next/server";
import { ingestNodeState } from "@/lib/aws/dynamodb";
import { getWorkflowConfig } from "@/lib/aws/workflows";
import { requireIngestAuth } from "@/lib/backend/auth";
import { buildRunIdentity, gitLabIngestSchema } from "@/lib/backend/model";

export async function POST(request: Request) {
  const authError = requireIngestAuth(request);
  if (authError) {
    return authError;
  }

  const parsed = gitLabIngestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid GitLab ingest payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const identity = buildRunIdentity(payload);
  const nodeId = payload.nodeId ?? "build";
  const status = payload.status ?? "running";
  const message = payload.message ?? `GitLab reported ${nodeId} as ${status}.`;
  const workflow = await getWorkflowConfig(identity);

  const write = await ingestNodeState({
    identity,
    nodeId,
    status,
    message,
    edges: workflow.edges,
    actor: payload.actor,
    metadata: {
      commitSha: payload.commitSha,
      branch: payload.branch,
      projectPath: payload.projectPath,
      pipelineId: payload.pipelineId,
      source: "gitlab",
    },
  });

  return NextResponse.json({
    ok: true,
    ...identity,
    nodeId,
    status,
    source: write.source,
  });
}
