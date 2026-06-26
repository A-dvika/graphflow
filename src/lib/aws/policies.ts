import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  policySortKey,
  projectPartitionKey,
  releasePolicySchema,
  type ReleasePolicyPayload,
} from "@/lib/backend/model";
import { defaultReleasePolicy, normalizeReleasePolicy, type ReleasePolicy } from "@/lib/backend/policy";
import { getDocumentClient, hasAwsConfig } from "@/lib/aws/dynamodb";

const tableName = process.env.GRAPHFLOW_RUNS_TABLE ?? "GraphFlowRuns";

type PolicyItem = ReleasePolicyPayload & {
  pk: string;
  sk: string;
  tenantId: string;
  policyId: string;
  updatedAt: string;
};

export async function getReleasePolicy(input?: {
  tenantId?: string;
  policyId?: string;
}): Promise<ReleasePolicy> {
  const tenantId = input?.tenantId ?? defaultReleasePolicy.tenantId;
  const policyId = input?.policyId ?? defaultReleasePolicy.policyId;

  if (!hasAwsConfig()) {
    return normalizeReleasePolicy({ tenantId, policyId });
  }

  const response = await getDocumentClient().send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk and sk = :sk",
      ExpressionAttributeValues: {
        ":pk": projectPartitionKey({ tenantId, projectId: "_org" }),
        ":sk": policySortKey(policyId),
      },
      Limit: 1,
    }),
  );
  const item = response.Items?.[0] as PolicyItem | undefined;

  if (!item) {
    return normalizeReleasePolicy({ tenantId, policyId });
  }

  return {
    ...normalizeReleasePolicy(item),
    source: "dynamodb",
  };
}

export async function putReleasePolicy(input: ReleasePolicyPayload) {
  const parsed = releasePolicySchema.parse(input);
  const policy = normalizeReleasePolicy(parsed);

  if (!hasAwsConfig()) {
    return {
      ...policy,
      source: "default" as const,
    };
  }

  const updatedAt = new Date().toISOString();

  await getDocumentClient().send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: projectPartitionKey({ tenantId: policy.tenantId, projectId: "_org" }),
        sk: policySortKey(policy.policyId),
        ...policy,
        source: undefined,
        updatedAt,
      },
    }),
  );

  return {
    ...policy,
    source: "dynamodb" as const,
    updatedAt,
  };
}
