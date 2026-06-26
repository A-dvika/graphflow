import { NextResponse } from "next/server";
import { getRunFromDynamoDB } from "@/lib/aws/dynamodb";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const run = await getRunFromDynamoDB(runId);

  return NextResponse.json(run);
}
