import { NextResponse } from "next/server";
import { getReleasePolicy, putReleasePolicy } from "@/lib/aws/policies";
import { requireIngestAuth } from "@/lib/backend/auth";
import { releasePolicySchema } from "@/lib/backend/model";

export async function GET(request: Request, context: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await context.params;
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  const policy = await getReleasePolicy({ tenantId, policyId });

  return NextResponse.json({
    ok: true,
    policy,
  });
}

export async function PUT(request: Request, context: { params: Promise<{ policyId: string }> }) {
  const authError = await requireIngestAuth(request);
  if (authError) {
    return authError;
  }

  const { policyId } = await context.params;
  const parsed = releasePolicySchema.safeParse({
    ...(await request.json()),
    policyId,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid release policy.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const policy = await putReleasePolicy(parsed.data);

  return NextResponse.json({
    ok: true,
    policy,
  });
}
