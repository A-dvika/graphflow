import {
  ExecuteStatementCommand,
  type Field,
  RDSDataClient,
} from "@aws-sdk/client-rds-data";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { type RunIdentity } from "@/lib/backend/model";
import { findCriticalPath, type FlowEdge, type FlowNode } from "@/lib/graphflow";

type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
};

type WorkflowNodeRow = {
  id: string;
  label: string;
  node_type: string;
  planned_duration_minutes: number;
  position_x: string;
  position_y: string;
};

type WorkflowEdgeRow = {
  from_node_id: string;
  to_node_id: string;
};

export type AuditEventInput = {
  identity: RunIdentity;
  eventType: string;
  actor?: string;
  nodeId?: string;
  status?: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type AuditEvent = {
  id: string;
  tenantId: string;
  projectId: string;
  workflowId: string;
  runId: string;
  eventType: string;
  actor: string | null;
  nodeId: string | null;
  status: string | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  source: "aurora-data-api" | "aurora-postgresql";
};

let pool: Pool | undefined;
let rdsDataClient: RDSDataClient | undefined;

function getDataApiConfig() {
  const resourceArn = process.env.AURORA_CLUSTER_ARN;
  const secretArn = process.env.AURORA_SECRET_ARN;
  const database = process.env.AURORA_DATABASE_NAME ?? process.env.AURORA_DB_NAME ?? "graphflow";

  if (!resourceArn || !secretArn) {
    return null;
  }

  return {
    database,
    resourceArn,
    secretArn,
  };
}

export function hasAuroraDataApiConfig() {
  return Boolean(getDataApiConfig());
}

function getDataApiClient() {
  rdsDataClient ??= new RDSDataClient({
    region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
  });

  return rdsDataClient;
}

function safeAwsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      name: "UnknownError",
    };
  }

  const candidate = error as {
    name?: string;
    $metadata?: {
      httpStatusCode?: number;
    };
  };

  return {
    name: candidate.name ?? "AwsError",
    httpStatusCode: candidate.$metadata?.httpStatusCode,
  };
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.DATABASE_SSL_DISABLED === "true" ? undefined : { rejectUnauthorized: false },
  });

  return pool;
}

function normalizeNodeType(value: string): FlowNode["type"] {
  if (value === "compute" || value === "quality" || value === "security" || value === "approval" || value === "deploy") {
    return value;
  }

  return "compute";
}

function stringField(field: Field | undefined) {
  if (!field || field.isNull) {
    return null;
  }

  if ("stringValue" in field && field.stringValue !== undefined) {
    return field.stringValue;
  }

  if ("longValue" in field && field.longValue !== undefined) {
    return String(field.longValue);
  }

  if ("doubleValue" in field && field.doubleValue !== undefined) {
    return String(field.doubleValue);
  }

  return null;
}

function numberField(field: Field | undefined) {
  if (!field || field.isNull) {
    return 0;
  }

  if ("longValue" in field && field.longValue !== undefined) {
    return field.longValue;
  }

  if ("doubleValue" in field && field.doubleValue !== undefined) {
    return field.doubleValue;
  }

  if ("stringValue" in field && field.stringValue !== undefined) {
    return Number(field.stringValue);
  }

  return 0;
}

function parseJsonField(field: Field | undefined) {
  const value = stringField(field);

  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function probeAuroraDataApi(workflowId = "release-command-center") {
  const config = getDataApiConfig();

  if (!config) {
    return {
      configured: false,
      ok: false,
      workflowRows: 0,
    };
  }

  try {
    const result = await getDataApiClient().send(
      new ExecuteStatementCommand({
        ...config,
        sql: "select count(*) from workflows where id = :workflowId",
        parameters: [
          {
            name: "workflowId",
            value: { stringValue: workflowId },
          },
        ],
      }),
    );

    return {
      configured: true,
      ok: true,
      workflowRows: numberField(result.records?.[0]?.[0]),
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      workflowRows: 0,
      error: safeAwsError(error),
    };
  }
}

async function getWorkflowFromAuroraDataApi(workflowId: string) {
  const config = getDataApiConfig();

  if (!config) {
    return null;
  }

  const client = getDataApiClient();
  const parameter = {
    name: "workflowId",
    value: { stringValue: workflowId },
  };

  const workflowResult = await client.send(
    new ExecuteStatementCommand({
      ...config,
      sql: "select id, name, description from workflows where id = :workflowId limit 1",
      parameters: [parameter],
    }),
  );
  const workflowRecord = workflowResult.records?.[0];

  if (!workflowRecord) {
    return null;
  }

  const nodesResult = await client.send(
    new ExecuteStatementCommand({
      ...config,
      sql: `select id, label, node_type, planned_duration_minutes, position_x, position_y
            from workflow_nodes
            where workflow_id = :workflowId
            order by id`,
      parameters: [parameter],
    }),
  );
  const edgesResult = await client.send(
    new ExecuteStatementCommand({
      ...config,
      sql: `select from_node_id, to_node_id
            from workflow_edges
            where workflow_id = :workflowId
            order by from_node_id, to_node_id`,
      parameters: [parameter],
    }),
  );

  const nodes: FlowNode[] = (nodesResult.records ?? []).map((record) => ({
    id: stringField(record[0]) ?? "",
    label: stringField(record[1]) ?? "",
    type: normalizeNodeType(stringField(record[2]) ?? "compute"),
    duration: numberField(record[3]),
    x: numberField(record[4]),
    y: numberField(record[5]),
  }));
  const edges: FlowEdge[] = (edgesResult.records ?? []).map((record) => ({
    from: stringField(record[0]) ?? "",
    to: stringField(record[1]) ?? "",
  }));

  return {
    workflow: {
      id: stringField(workflowRecord[0]) ?? workflowId,
      name: stringField(workflowRecord[1]) ?? "Production Release",
      description: stringField(workflowRecord[2]) ?? "Workflow graph loaded from Aurora PostgreSQL.",
    },
    nodes,
    edges,
    analysis: {
      criticalPath: findCriticalPath(nodes, edges),
    },
    source: "aurora-data-api" as const,
  };
}

async function getWorkflowFromAuroraPg(workflowId: string) {
  const auroraPool = getPool();

  if (!auroraPool) {
    return null;
  }

  try {
    const client = await auroraPool.connect();

    try {
      const workflowResult = await client.query<WorkflowRow>(
        "select id, name, description from workflows where id = $1 limit 1",
        [workflowId],
      );
      const workflow = workflowResult.rows[0];

      if (!workflow) {
        return null;
      }

      const nodesResult = await client.query<WorkflowNodeRow>(
        `select id, label, node_type, planned_duration_minutes, position_x, position_y
         from workflow_nodes
         where workflow_id = $1
         order by id`,
        [workflowId],
      );
      const edgesResult = await client.query<WorkflowEdgeRow>(
        `select from_node_id, to_node_id
         from workflow_edges
         where workflow_id = $1
         order by from_node_id, to_node_id`,
        [workflowId],
      );

      const nodes: FlowNode[] = nodesResult.rows.map((node) => ({
        id: node.id,
        label: node.label,
        type: normalizeNodeType(node.node_type),
        duration: node.planned_duration_minutes,
        x: Number(node.position_x),
        y: Number(node.position_y),
      }));
      const edges: FlowEdge[] = edgesResult.rows.map((edge) => ({
        from: edge.from_node_id,
        to: edge.to_node_id,
      }));

      return {
        workflow: {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description ?? "Workflow graph loaded from Aurora PostgreSQL.",
        },
        nodes,
        edges,
        analysis: {
          criticalPath: findCriticalPath(nodes, edges),
        },
        source: "aurora-postgresql" as const,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Failed to load workflow graph from Aurora", error);
    return null;
  }
}

export async function getWorkflowFromAurora(workflowId = "release-command-center") {
  try {
    const dataApiWorkflow = await getWorkflowFromAuroraDataApi(workflowId);

    if (dataApiWorkflow) {
      return dataApiWorkflow;
    }
  } catch (error) {
    console.error("Failed to load workflow graph from Aurora Data API", error);
  }

  return getWorkflowFromAuroraPg(workflowId);
}

export async function writeAuditEventToAurora(input: AuditEventInput) {
  const id = randomUUID();
  const metadata = JSON.stringify(input.metadata ?? {});
  const config = getDataApiConfig();

  if (config) {
    try {
      await getDataApiClient().send(
        new ExecuteStatementCommand({
          ...config,
          sql: `insert into release_audit_events
                (id, tenant_id, project_id, workflow_id, run_id, event_type, actor, node_id, status, message, metadata)
                values
                (:id, :tenantId, :projectId, :workflowId, :runId, :eventType, :actor, :nodeId, :status, :message, cast(:metadata as jsonb))`,
          parameters: [
            { name: "id", value: { stringValue: id } },
            { name: "tenantId", value: { stringValue: input.identity.tenantId } },
            { name: "projectId", value: { stringValue: input.identity.projectId } },
            { name: "workflowId", value: { stringValue: input.identity.workflowId } },
            { name: "runId", value: { stringValue: input.identity.runId } },
            { name: "eventType", value: { stringValue: input.eventType } },
            { name: "actor", value: input.actor ? { stringValue: input.actor } : { isNull: true } },
            { name: "nodeId", value: input.nodeId ? { stringValue: input.nodeId } : { isNull: true } },
            { name: "status", value: input.status ? { stringValue: input.status } : { isNull: true } },
            { name: "message", value: { stringValue: input.message } },
            { name: "metadata", value: { stringValue: metadata } },
          ],
        }),
      );

      return { id, source: "aurora-data-api" as const };
    } catch (error) {
      console.error("Failed to write audit event through Aurora Data API", error);
    }
  }

  const auroraPool = getPool();

  if (!auroraPool) {
    return { id, source: "unavailable" as const };
  }

  try {
    await auroraPool.query(
      `insert into release_audit_events
       (id, tenant_id, project_id, workflow_id, run_id, event_type, actor, node_id, status, message, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        id,
        input.identity.tenantId,
        input.identity.projectId,
        input.identity.workflowId,
        input.identity.runId,
        input.eventType,
        input.actor ?? null,
        input.nodeId ?? null,
        input.status ?? null,
        input.message,
        metadata,
      ],
    );

    return { id, source: "aurora-postgresql" as const };
  } catch (error) {
    console.error("Failed to write audit event to Aurora PostgreSQL", error);
    return { id, source: "unavailable" as const };
  }
}

export async function getAuditEventsFromAurora(identity: RunIdentity): Promise<AuditEvent[]> {
  const config = getDataApiConfig();

  if (config) {
    try {
      const result = await getDataApiClient().send(
        new ExecuteStatementCommand({
          ...config,
          sql: `select id, tenant_id, project_id, workflow_id, run_id, event_type, actor, node_id, status, message, metadata::text, created_at::text
                from release_audit_events
                where tenant_id = :tenantId and project_id = :projectId and workflow_id = :workflowId and run_id = :runId
                order by created_at asc
                limit 500`,
          parameters: [
            { name: "tenantId", value: { stringValue: identity.tenantId } },
            { name: "projectId", value: { stringValue: identity.projectId } },
            { name: "workflowId", value: { stringValue: identity.workflowId } },
            { name: "runId", value: { stringValue: identity.runId } },
          ],
        }),
      );

      return (result.records ?? []).map((record) => ({
        id: stringField(record[0]) ?? "",
        tenantId: stringField(record[1]) ?? identity.tenantId,
        projectId: stringField(record[2]) ?? identity.projectId,
        workflowId: stringField(record[3]) ?? identity.workflowId,
        runId: stringField(record[4]) ?? identity.runId,
        eventType: stringField(record[5]) ?? "unknown",
        actor: stringField(record[6]),
        nodeId: stringField(record[7]),
        status: stringField(record[8]),
        message: stringField(record[9]) ?? "",
        metadata: parseJsonField(record[10]),
        createdAt: stringField(record[11]) ?? "",
        source: "aurora-data-api" as const,
      }));
    } catch (error) {
      console.error("Failed to read audit events through Aurora Data API", error);
    }
  }

  const auroraPool = getPool();

  if (!auroraPool) {
    return [];
  }

  try {
    const result = await auroraPool.query(
      `select id, tenant_id, project_id, workflow_id, run_id, event_type, actor, node_id, status, message, metadata, created_at::text
       from release_audit_events
       where tenant_id = $1 and project_id = $2 and workflow_id = $3 and run_id = $4
       order by created_at asc
       limit 500`,
      [identity.tenantId, identity.projectId, identity.workflowId, identity.runId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      workflowId: row.workflow_id,
      runId: row.run_id,
      eventType: row.event_type,
      actor: row.actor,
      nodeId: row.node_id,
      status: row.status,
      message: row.message,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      source: "aurora-postgresql" as const,
    }));
  } catch (error) {
    console.error("Failed to read audit events from Aurora PostgreSQL", error);
    return [];
  }
}
