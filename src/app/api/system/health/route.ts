import { NextResponse } from "next/server";
import { getWorkflowConfig } from "@/lib/aws/workflows";
import { hasAuroraDataApiConfig, probeAuroraDataApi } from "@/lib/aws/aurora";
import { hasAwsConfig } from "@/lib/aws/dynamodb";
import { getAgentConfig } from "@/lib/agent/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  const auroraProbe = await probeAuroraDataApi();
  const workflow = await getWorkflowConfig({});
  const agent = getAgentConfig();

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
    agent: {
      configured: agent.configured,
      provider: agent.provider,
      modelConfigured: Boolean(process.env.GRAPHFLOW_LLM_MODEL),
    },
  });
}
