import { NextResponse } from "next/server";
import { applyRunAction } from "@/lib/aws/dynamodb";

type RunAction = "reset" | "start" | "fail-security" | "approve";

function isRunAction(value: unknown): value is RunAction {
  return value === "reset" || value === "start" || value === "fail-security" || value === "approve";
}

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const payload = (await request.json()) as { action?: unknown };

  if (!isRunAction(payload.action)) {
    return NextResponse.json(
      {
        error: "Invalid run action.",
        allowedActions: ["reset", "start", "fail-security", "approve"],
      },
      { status: 400 },
    );
  }

  const run = await applyRunAction({
    runId,
    action: payload.action,
  });

  return NextResponse.json(run);
}
