import { NextResponse } from "next/server";
import { getWorkflowConfig } from "@/lib/aws/workflows";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workflow = await getWorkflowConfig({
    tenantId: url.searchParams.get("tenantId") ?? undefined,
    projectId: url.searchParams.get("projectId") ?? undefined,
    projectPath: url.searchParams.get("projectPath") ?? undefined,
    workflowId: url.searchParams.get("workflowId") ?? undefined,
  });

  return NextResponse.json(workflow);
}
