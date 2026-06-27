import { NextResponse } from "next/server";
import { putWorkflowConfig } from "@/lib/aws/workflows";
import { requireIngestAuth } from "@/lib/backend/auth";
import { workflowConfigSchema } from "@/lib/backend/model";

export async function POST(request: Request) {
  const authError = await requireIngestAuth(request);
  if (authError) {
    return authError;
  }

  const parsed = workflowConfigSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid workflow config.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const workflow = await putWorkflowConfig(parsed.data);

  return NextResponse.json({
    ok: true,
    workflow,
  });
}
