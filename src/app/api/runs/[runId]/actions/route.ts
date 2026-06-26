import { NextResponse } from "next/server";
import { applyRunAction } from "@/lib/aws/dynamodb";
import { buildRunIdentity, runActionSchema } from "@/lib/backend/model";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const url = new URL(request.url);
  const payload = (await request.json()) as { action?: unknown };
  const action = runActionSchema.safeParse(payload.action);

  if (!action.success) {
    return NextResponse.json(
      {
        error: "Invalid run action.",
        allowedActions: ["reset", "start", "fail-security", "approve"],
      },
      { status: 400 },
    );
  }

  const run = await applyRunAction({
    identity: buildRunIdentity({
      tenantId: url.searchParams.get("tenantId") ?? undefined,
      projectId: url.searchParams.get("projectId") ?? undefined,
      projectPath: url.searchParams.get("projectPath") ?? undefined,
      workflowId: url.searchParams.get("workflowId") ?? undefined,
      runId,
    }),
    action: action.data,
  });

  return NextResponse.json(run);
}
