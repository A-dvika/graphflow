import { NextResponse } from "next/server";
import { getWorkflowConfig } from "@/lib/aws/workflows";
import { hasAuroraDataApiConfig, probeAuroraDataApi } from "@/lib/aws/aurora";
import { hasAwsConfig } from "@/lib/aws/dynamodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const auroraProbe = await probeAuroraDataApi();
  const workflow = await getWorkflowConfig({});

  return NextResponse.json({
    ok: workflow.source !== "demo-fallback",
    aws: {
      configured: hasAwsConfig(),
      regionConfigured: Boolean(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION),
    },
    aurora: {
      dataApiConfigured: hasAuroraDataApiConfig(),
      directPostgresConfigured: Boolean(process.env.DATABASE_URL),
      probe: auroraProbe,
    },
    workflow: {
      source: workflow.source,
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
    },
  });
}
