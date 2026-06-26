import { graphflowFetch, graphflowContext } from "./client.mjs";

const nodeId = process.argv[2];
const rawStatus = process.argv[3];
const message = process.argv.slice(4).join(" ");

const statusMap = {
  success: "success",
  failed: "failed",
  canceled: "failed",
  skipped: "blocked",
  manual: "waiting",
  waiting: "waiting",
  running: "running",
};

if (!nodeId || !rawStatus) {
  console.error("Usage: node graphflow/report-node.mjs <nodeId> <status> [message]");
  process.exit(1);
}

const context = graphflowContext();
const status = statusMap[rawStatus] ?? "pending";
const payload = {
  tenantId: context.tenantId,
  projectId: context.projectId,
  workflowId: context.workflowId,
  runId: context.runId,
  nodeId,
  status,
  message: message || `${nodeId} reported ${status}.`,
  commitSha: context.commitSha,
  branch: context.branch,
  actor: context.actor,
};

const { response, body } = await graphflowFetch("/api/ingest/gitlab", {
  method: "POST",
  body: JSON.stringify(payload),
});

if (!response.ok) {
  console.error(`GraphFlow node report failed for ${nodeId}.`);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(`GraphFlow node ${nodeId} -> ${status}.`);
