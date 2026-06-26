import { readFile } from "node:fs/promises";
import { dashboardUrl, graphflowFetch, graphflowContext } from "./client.mjs";

const context = graphflowContext();
const config = JSON.parse(await readFile("graphflow/graphflow.config.json", "utf8"));
const payload = {
  ...config,
  tenantId: context.tenantId,
  projectId: context.projectId,
  workflowId: context.workflowId,
};

const { response, body } = await graphflowFetch("/api/workflows/register", {
  method: "POST",
  body: JSON.stringify(payload),
});

if (!response.ok) {
  console.error("GraphFlow workflow registration failed.");
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(`GraphFlow workflow registered for ${context.projectId}.`);
console.log(`GraphFlow dashboard: ${dashboardUrl(context)}`);
