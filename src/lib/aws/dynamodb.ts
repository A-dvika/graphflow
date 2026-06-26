import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  buildRunIdentity,
  defaultRunId,
  legacyRunPartitionKey,
  normalizeStatus,
  projectRunSortKey,
  projectRunsPartitionKey,
  runPartitionKey,
  ttlFromNow,
  type RunAction,
  type RunIdentity,
} from "@/lib/backend/model";
import { analyzeRun, downstreamOf, initialStatuses, releaseNodes, type Status } from "@/lib/graphflow";

type RunItem = {
  pk: string;
  sk: string;
  gsi1pk?: string;
  gsi1sk?: string;
  tenantId?: string;
  projectId?: string;
  workflowId?: string;
  runId?: string;
  nodeId?: string;
  status?: Status | string;
  message?: string;
  updatedAt?: string;
};

export type ReleaseRun = {
  tenantId: string;
  projectId: string;
  runId: string;
  workflowId: string;
  statuses: Record<string, Status>;
  events: string[];
  source: "dynamodb" | "demo-fallback";
  analysis: ReturnType<typeof analyzeRun>;
};

export type ReleaseRunSummary = {
  tenantId: string;
  projectId: string;
  runId: string;
  workflowId: string;
  status: string;
  message: string;
  updatedAt: string;
};

const tableName = process.env.GRAPHFLOW_RUNS_TABLE ?? "GraphFlowRuns";
const eventBusName = process.env.GRAPHFLOW_EVENT_BUS ?? "graphflow-events";
const retentionDays = Number(process.env.GRAPHFLOW_RUN_RETENTION_DAYS ?? 30);

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

export function getDocumentClient() {
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

function runStatusFromNodes(statuses: Record<string, Status>) {
  if (Object.values(statuses).includes("failed") || Object.values(statuses).includes("blocked")) {
    return "blocked";
  }

  if (Object.values(statuses).every((status) => status === "success")) {
    return "success";
  }

  if (Object.values(statuses).includes("waiting")) {
    return "waiting";
  }

  return "running";
}

function itemIdentity(item: RunItem, fallbackRunId: string): RunIdentity {
  return buildRunIdentity({
    tenantId: item.tenantId,
    projectId: item.projectId,
    workflowId: item.workflowId,
    runId: item.runId ?? fallbackRunId,
  });
}

function materializeRun(items: RunItem[], fallbackRunId: string, source: ReleaseRun["source"]): ReleaseRun {
  const statuses: Record<string, Status> = { ...initialStatuses };
  const events: string[] = [];
  const meta = items.find((item) => item.sk === "META");
  const identity = itemIdentity(meta ?? items[0] ?? { pk: fallbackRunId, sk: "META" }, fallbackRunId);
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
    ...identity,
    statuses,
    events,
    source,
    analysis: analyzeRun(statuses),
  };
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

  const statuses: Record<string, Status> = Object.fromEntries(
    releaseNodes.map((node) => [node.id, "success"]),
  ) as Record<string, Status>;
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

export function getDemoRun(runId = defaultRunId): ReleaseRun {
  return {
    ...buildRunIdentity({ runId }),
    ...buildActionSnapshot("fail-security"),
    source: "demo-fallback",
  };
}

export async function getRunFromDynamoDB(run: string | RunIdentity): Promise<ReleaseRun> {
  const identity = typeof run === "string" ? buildRunIdentity({ runId: run }) : run;

  if (!hasAwsConfig()) {
    return getDemoRun(identity.runId);
  }

  const documentClient = getDocumentClient();
  const keysToTry = [runPartitionKey(identity), legacyRunPartitionKey(identity.runId)];

  for (const pk of keysToTry) {
    const response = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": pk,
        },
      }),
    );

    const items = (response.Items ?? []) as RunItem[];

    if (items.length > 0) {
      return materializeRun(items, identity.runId, "dynamodb");
    }
  }

  return getDemoRun(identity.runId);
}

export async function listProjectRuns(input: { tenantId?: string; projectId?: string; limit?: number }) {
  if (!hasAwsConfig()) {
    const demo = getDemoRun();

    return [
      {
        tenantId: demo.tenantId,
        projectId: demo.projectId,
        runId: demo.runId,
        workflowId: demo.workflowId,
        status: runStatusFromNodes(demo.statuses),
        message: demo.events[0] ?? "Demo run.",
        updatedAt: new Date(0).toISOString(),
      },
    ] satisfies ReleaseRunSummary[];
  }

  const identity = buildRunIdentity(input);
  const response = await getDocumentClient().send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": projectRunsPartitionKey(identity),
      },
      ScanIndexForward: false,
      Limit: input.limit ?? 20,
    }),
  );

  return ((response.Items ?? []) as RunItem[]).map((item) => ({
    tenantId: item.tenantId ?? identity.tenantId,
    projectId: item.projectId ?? identity.projectId,
    runId: item.runId ?? defaultRunId,
    workflowId: item.workflowId ?? "release-command-center",
    status: String(item.status ?? "unknown"),
    message: item.message ?? "",
    updatedAt: item.updatedAt ?? "",
  }));
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

export async function putRunSnapshot(input: {
  identity: RunIdentity;
  statuses: Record<string, Status>;
  messages: Partial<Record<string, string>>;
  metaMessage: string;
  detailType: string;
}) {
  const run: ReleaseRun = {
    ...input.identity,
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
  const expiresAt = ttlFromNow(retentionDays);
  const pk = runPartitionKey(input.identity);
  const projectPk = projectRunsPartitionKey(input.identity);
  const runStatus = runStatusFromNodes(input.statuses);

  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk,
        sk: "META",
        gsi1pk: projectPk,
        gsi1sk: projectRunSortKey(timestamp, input.identity.runId),
        tenantId: input.identity.tenantId,
        projectId: input.identity.projectId,
        workflowId: input.identity.workflowId,
        runId: input.identity.runId,
        status: runStatus,
        message: input.metaMessage,
        updatedAt: timestamp,
        expiresAt,
      },
    }),
  );

  await Promise.all(
    releaseNodes.map((node) =>
      documentClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            pk,
            sk: `NODE#${node.id}`,
            tenantId: input.identity.tenantId,
            projectId: input.identity.projectId,
            workflowId: input.identity.workflowId,
            runId: input.identity.runId,
            nodeId: node.id,
            status: input.statuses[node.id],
            message: input.messages[node.id] ?? `${node.label}: ${input.statuses[node.id]}.`,
            updatedAt: timestamp,
            expiresAt,
          },
        }),
      ),
    ),
  );

  await publishRunEvent({
    runId: input.identity.runId,
    detailType: input.detailType,
    detail: {
      tenantId: input.identity.tenantId,
      projectId: input.identity.projectId,
      workflowId: input.identity.workflowId,
      statuses: input.statuses,
      analysis: run.analysis,
    },
  });

  return run;
}

export async function putRunNodeState(input: {
  identity: RunIdentity;
  nodeId: string;
  status: Status;
  message: string;
}) {
  if (!hasAwsConfig()) {
    return { source: "demo-fallback" as const };
  }

  const timestamp = new Date().toISOString();
  await getDocumentClient().send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: runPartitionKey(input.identity),
        sk: `NODE#${input.nodeId}`,
        tenantId: input.identity.tenantId,
        projectId: input.identity.projectId,
        workflowId: input.identity.workflowId,
        runId: input.identity.runId,
        nodeId: input.nodeId,
        status: input.status,
        message: input.message,
        updatedAt: timestamp,
        expiresAt: ttlFromNow(retentionDays),
      },
    }),
  );

  await publishRunEvent({
    runId: input.identity.runId,
    detailType: `node.${input.status}`,
    detail: {
      tenantId: input.identity.tenantId,
      projectId: input.identity.projectId,
      workflowId: input.identity.workflowId,
      nodeId: input.nodeId,
      status: input.status,
      message: input.message,
    },
  });

  return { source: "dynamodb" as const };
}

export async function ingestNodeState(input: {
  identity: RunIdentity;
  nodeId: string;
  status: Status;
  message: string;
}) {
  const write = await putRunNodeState(input);

  if (input.status === "failed") {
    await Promise.all(
      [...downstreamOf(input.nodeId)].map((blockedNodeId) =>
        putRunNodeState({
          identity: input.identity,
          nodeId: blockedNodeId,
          status: "blocked",
          message: `Blocked by failed upstream node: ${input.nodeId}.`,
        }),
      ),
    );
  }

  return write;
}

export async function applyRunAction(input: {
  identity: RunIdentity;
  action: RunAction;
}) {
  const snapshot = buildActionSnapshot(input.action);

  return putRunSnapshot({
    identity: input.identity,
    statuses: snapshot.statuses,
    messages: snapshot.messages,
    metaMessage: snapshot.metaMessage,
    detailType: snapshot.detailType,
  });
}
