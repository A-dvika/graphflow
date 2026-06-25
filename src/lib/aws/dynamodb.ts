import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { analyzeRun, initialStatuses, releaseNodes, type Status } from "@/lib/graphflow";

type RunItem = {
  pk: string;
  sk: string;
  workflowId?: string;
  nodeId?: string;
  status?: Status | string;
  message?: string;
};

export type ReleaseRun = {
  runId: string;
  workflowId: string;
  statuses: Record<string, Status>;
  events: string[];
  source: "dynamodb" | "demo-fallback";
  analysis: ReturnType<typeof analyzeRun>;
};

const tableName = process.env.GRAPHFLOW_RUNS_TABLE ?? "GraphFlowRuns";

function hasAwsConfig() {
  return Boolean(
    process.env.AWS_REGION &&
      (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || process.env.AWS_WEB_IDENTITY_TOKEN_FILE),
  );
}

function getDocumentClient() {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
  });

  return DynamoDBDocumentClient.from(client);
}

function normalizeStatus(value: string | undefined): Status {
  if (
    value === "pending" ||
    value === "running" ||
    value === "success" ||
    value === "failed" ||
    value === "blocked" ||
    value === "waiting"
  ) {
    return value;
  }

  return "pending";
}

export function getDemoRun(runId = "run_demo_001"): ReleaseRun {
  const statuses: Record<string, Status> = {
    ...initialStatuses,
    build: "success",
    unit: "success",
    scan: "failed",
    approval: "blocked",
    staging: "blocked",
    smoke: "blocked",
    prod: "blocked",
  };

  const events = [
    "Build completed.",
    "Unit Tests completed.",
    "Security Scan failed.",
    "Approval is blocked by Security Scan.",
    "Production deploy is blocked by upstream dependency.",
  ];

  return {
    runId,
    workflowId: "release-command-center",
    statuses,
    events,
    source: "demo-fallback",
    analysis: analyzeRun(statuses),
  };
}

export async function getRunFromDynamoDB(runId: string): Promise<ReleaseRun> {
  if (!hasAwsConfig()) {
    return getDemoRun(runId);
  }

  const documentClient = getDocumentClient();
  const response = await documentClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": runId,
      },
    }),
  );

  const items = (response.Items ?? []) as RunItem[];

  if (items.length === 0) {
    return getDemoRun(runId);
  }

  const statuses: Record<string, Status> = { ...initialStatuses };
  const events: string[] = [];
  const meta = items.find((item) => item.sk === "META");

  for (const item of items) {
    if (item.nodeId && releaseNodes.some((node) => node.id === item.nodeId)) {
      statuses[item.nodeId] = normalizeStatus(item.status);
    }

    if (item.message) {
      events.push(item.message);
    }
  }

  return {
    runId,
    workflowId: meta?.workflowId ?? "release-command-center",
    statuses,
    events,
    source: "dynamodb",
    analysis: analyzeRun(statuses),
  };
}

export async function putRunNodeState(input: {
  runId: string;
  workflowId?: string;
  nodeId: string;
  status: Status;
  message: string;
}) {
  if (!hasAwsConfig()) {
    return { source: "demo-fallback" as const };
  }

  const documentClient = getDocumentClient();
  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: input.runId,
        sk: `NODE#${input.nodeId}`,
        workflowId: input.workflowId ?? "release-command-center",
        nodeId: input.nodeId,
        status: input.status,
        message: input.message,
        updatedAt: new Date().toISOString(),
      },
    }),
  );

  return { source: "dynamodb" as const };
}
