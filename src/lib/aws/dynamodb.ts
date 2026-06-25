import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { analyzeRun, initialStatuses, releaseNodes, type Status } from "@/lib/graphflow";

type RunAction = "reset" | "start" | "fail-security" | "approve";

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
const eventBusName = process.env.GRAPHFLOW_EVENT_BUS ?? "graphflow-events";

export function hasAwsConfig() {
  return Boolean(
    (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION) &&
      (process.env.AWS_ACCESS_KEY_ID ||
        process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
        process.env.AWS_WEB_IDENTITY_TOKEN_FILE),
  );
}

function getAwsRegion() {
  return process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
}

function getDocumentClient() {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: getAwsRegion(),
    }),
  );
}

function getEventBridgeClient() {
  return new EventBridgeClient({
    region: getAwsRegion(),
  });
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
  return {
    runId,
    workflowId: "release-command-center",
    ...buildActionSnapshot("fail-security"),
    source: "demo-fallback",
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
  const nodeOrder = new Map(releaseNodes.map((node, index) => [node.id, index]));

  for (const item of items) {
    if (item.nodeId && releaseNodes.some((node) => node.id === item.nodeId)) {
      statuses[item.nodeId] = normalizeStatus(item.status);
    }
  }

  if (meta?.message) {
    events.push(meta.message);
  }

  items
    .filter((item) => item.message && item.nodeId)
    .sort((a, b) => (nodeOrder.get(a.nodeId ?? "") ?? 99) - (nodeOrder.get(b.nodeId ?? "") ?? 99))
    .forEach((item) => events.push(item.message!));

  return {
    runId,
    workflowId: meta?.workflowId ?? "release-command-center",
    statuses,
    events,
    source: "dynamodb",
    analysis: analyzeRun(statuses),
  };
}

export async function publishRunEvent(input: {
  runId: string;
  detailType: string;
  detail: Record<string, unknown>;
}) {
  if (!hasAwsConfig()) {
    return { source: "demo-fallback" as const };
  }

  await getEventBridgeClient().send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName,
          Source: "graphflow.release",
          DetailType: input.detailType,
          Detail: JSON.stringify({
            runId: input.runId,
            ...input.detail,
          }),
        },
      ],
    }),
  );

  return { source: "eventbridge" as const };
}

export function buildActionSnapshot(action: RunAction) {
  if (action === "reset") {
    const statuses = { ...initialStatuses };
    const events = ["Release run reset."];

    return {
      statuses,
      events,
      analysis: analyzeRun(statuses),
      detailType: "run.reset",
      messages: Object.fromEntries(releaseNodes.map((node) => [node.id, `${node.label} reset to pending.`])),
      metaMessage: events[0],
    };
  }

  if (action === "start") {
    const statuses: Record<string, Status> = {
      ...initialStatuses,
      build: "success",
      unit: "success",
      scan: "success",
      approval: "waiting",
    };
    const events = [
      "Release started. Build, tests, and security scan completed. Approval is waiting.",
      "Build completed.",
      "Unit Tests completed.",
      "Security Scan passed.",
      "Release Approval is waiting on humans.",
    ];

    return {
      statuses,
      events,
      analysis: analyzeRun(statuses),
      detailType: "approval.waiting",
      messages: {
        build: events[1],
        unit: events[2],
        scan: events[3],
        approval: events[4],
      },
      metaMessage: events[0],
    };
  }

  if (action === "fail-security") {
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
      "Security Scan failed. GraphFlow blocked every downstream production step.",
      "Build completed.",
      "Unit Tests completed.",
      "Security Scan failed.",
      "Approval blocked by Security Scan.",
      "Staging deploy blocked by Security Scan.",
      "Smoke Test blocked by Security Scan.",
      "Production deploy blocked by upstream dependency.",
    ];

    return {
      statuses,
      events,
      analysis: analyzeRun(statuses),
      detailType: "node.failed",
      messages: {
        build: events[1],
        unit: events[2],
        scan: events[3],
        approval: events[4],
        staging: events[5],
        smoke: events[6],
        prod: events[7],
      },
      metaMessage: events[0],
    };
  }

  const statuses: Record<string, Status> = {
    ...initialStatuses,
    build: "success",
    unit: "success",
    scan: "success",
    approval: "success",
    staging: "success",
    smoke: "success",
    prod: "success",
  };
  const events = [
    "Approval granted. Production release completed successfully.",
    "Build completed.",
    "Unit Tests completed.",
    "Security Scan passed.",
    "Approval granted.",
    "Staging deploy completed.",
    "Smoke Test completed.",
    "Production deploy succeeded.",
  ];

  return {
    statuses,
    events,
    analysis: analyzeRun(statuses),
    detailType: "run.completed",
    messages: {
      build: events[1],
      unit: events[2],
      scan: events[3],
      approval: events[4],
      staging: events[5],
      smoke: events[6],
      prod: events[7],
    },
    metaMessage: events[0],
  };
}

export async function putRunSnapshot(input: {
  runId: string;
  workflowId?: string;
  statuses: Record<string, Status>;
  messages: Partial<Record<string, string>>;
  metaMessage: string;
  detailType: string;
}) {
  const workflowId = input.workflowId ?? "release-command-center";
  const run: ReleaseRun = {
    runId: input.runId,
    workflowId,
    statuses: input.statuses,
    events: [
      input.metaMessage,
      ...releaseNodes
        .map((node) => input.messages[node.id])
        .filter((message): message is string => Boolean(message)),
    ],
    source: hasAwsConfig() ? "dynamodb" : "demo-fallback",
    analysis: analyzeRun(input.statuses),
  };

  if (!hasAwsConfig()) {
    return run;
  }

  const documentClient = getDocumentClient();
  const timestamp = new Date().toISOString();
  const runStatus = Object.values(input.statuses).includes("failed")
    ? "blocked"
    : Object.values(input.statuses).every((status) => status === "success")
      ? "success"
      : "running";

  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: input.runId,
        sk: "META",
        workflowId,
        status: runStatus,
        message: input.metaMessage,
        updatedAt: timestamp,
      },
    }),
  );

  await Promise.all(
    releaseNodes.map((node) =>
      documentClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            pk: input.runId,
            sk: `NODE#${node.id}`,
            workflowId,
            nodeId: node.id,
            status: input.statuses[node.id],
            message: input.messages[node.id] ?? `${node.label}: ${input.statuses[node.id]}.`,
            updatedAt: timestamp,
          },
        }),
      ),
    ),
  );

  await publishRunEvent({
    runId: input.runId,
    detailType: input.detailType,
    detail: {
      workflowId,
      statuses: input.statuses,
      analysis: run.analysis,
    },
  });

  return run;
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

  await getDocumentClient().send(
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

  await publishRunEvent({
    runId: input.runId,
    detailType: `node.${input.status}`,
    detail: {
      workflowId: input.workflowId ?? "release-command-center",
      nodeId: input.nodeId,
      status: input.status,
      message: input.message,
    },
  });

  return { source: "dynamodb" as const };
}

export async function applyRunAction(input: {
  runId: string;
  action: RunAction;
}) {
  const snapshot = buildActionSnapshot(input.action);

  return putRunSnapshot({
    runId: input.runId,
    statuses: snapshot.statuses,
    messages: snapshot.messages,
    metaMessage: snapshot.metaMessage,
    detailType: snapshot.detailType,
  });
}
