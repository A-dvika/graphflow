import { Pool } from "pg";
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

let pool: Pool | undefined;

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

export async function getWorkflowFromAurora(workflowId = "release-command-center") {
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
