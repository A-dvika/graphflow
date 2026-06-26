import { dashboardUrl, graphflowFetch, graphflowContext } from "./client.mjs";

const context = graphflowContext();
const query = new URLSearchParams({
  tenantId: context.tenantId,
  projectId: context.projectId,
  workflowId: context.workflowId,
  failOn: "FAIL",
});

const { response, body } = await graphflowFetch(`/api/runs/${encodeURIComponent(context.runId)}/gate?${query.toString()}`, {
  method: "GET",
});

console.log(JSON.stringify(body, null, 2));
console.log(`GraphFlow dashboard: ${dashboardUrl(context)}`);

if (!response.ok) {
  console.error("GraphFlow blocked production deployment.");
  process.exit(1);
}

console.log("GraphFlow release gate passed.");
