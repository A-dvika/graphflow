import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  buildRunIdentity,
  projectPartitionKey,
  workflowSortKey,
  type WorkflowConfigPayload,
} from "@/lib/backend/model";
import { findCriticalPath, releaseEdges, releaseNodes } from "@/lib/graphflow";
import { getDocumentClient, hasAwsConfig } from "@/lib/aws/dynamodb";

const tableName = process.env.GRAPHFLOW_RUNS_TABLE ?? "GraphFlowRuns";

type WorkflowItem = {
  pk: string;
  sk: string;
  tenantId: string;
  projectId: string;
  workflowId: string;
  name: string;
  nodes: WorkflowConfigPayload["nodes"];
  edges: WorkflowConfigPayload["edges"];
  updatedAt: string;
};

export function getFallbackWorkflow() {
  return {
    workflow: {
      id: "release-command-center",
      name: "Production Release",
      description: "Demo workflow stored as graph primitives.",
    },
    nodes: releaseNodes,
    edges: releaseEdges,
    analysis: {
      criticalPath: findCriticalPath(),
    },
    source: "demo-fallback" as const,
  };
}

export async function putWorkflowConfig(input: WorkflowConfigPayload) {
  const identity = buildRunIdentity({
    tenantId: input.tenantId,
    projectId: input.projectId,
    projectPath: input.projectPath,
    workflowId: input.workflowId,
  });
  const updatedAt = new Date().toISOString();
  const workflowId = identity.workflowId;
  const item: WorkflowItem = {
    pk: projectPartitionKey(identity),
    sk: workflowSortKey(workflowId),
    tenantId: identity.tenantId,
    projectId: identity.projectId,
    workflowId,
    name: input.name,
    nodes: input.nodes,
    edges: input.edges,
    updatedAt,
  };

  if (!hasAwsConfig()) {
    return {
      ...item,
      source: "demo-fallback" as const,
    };
  }

  await getDocumentClient().send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    }),
  );

  return {
    ...item,
    source: "dynamodb" as const,
  };
}

export async function getWorkflowConfig(input: {
  tenantId?: string;
  projectId?: string;
  projectPath?: string;
  workflowId?: string;
}) {
  const identity = buildRunIdentity(input);

  if (!hasAwsConfig()) {
    return getFallbackWorkflow();
  }

  const response = await getDocumentClient().send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk and sk = :sk",
      ExpressionAttributeValues: {
        ":pk": projectPartitionKey(identity),
        ":sk": workflowSortKey(identity.workflowId),
      },
      Limit: 1,
    }),
  );
  const item = response.Items?.[0] as WorkflowItem | undefined;

  if (!item) {
    return getFallbackWorkflow();
  }

  return {
    workflow: {
      id: item.workflowId,
      name: item.name,
      description: "Workflow config registered from project CI/CD onboarding.",
    },
    nodes: item.nodes,
    edges: item.edges.map(([from, to]) => ({ from, to })),
    source: "dynamodb" as const,
    updatedAt: item.updatedAt,
  };
}
