import { NextResponse } from "next/server";
import { listProjectRuns } from "@/lib/aws/dynamodb";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 20);

  const runs = await listProjectRuns({
    tenantId,
    projectId,
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20,
  });

  return NextResponse.json({
    projectId,
    runs,
  });
}
