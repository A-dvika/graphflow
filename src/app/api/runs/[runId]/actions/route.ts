import { NextResponse } from "next/server";
import { applyRunAction } from "@/lib/aws/dynamodb";
import { buildRunIdentity, runActionSchema } from "@/lib/backend/model";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
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
    identity: buildRunIdentity({ runId }),
    action: action.data,
  });

  return NextResponse.json(run);
}
