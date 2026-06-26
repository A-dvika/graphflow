import { readFile } from "node:fs/promises";
import { dashboardUrl, graphflowContext, graphflowFetch, tokenFingerprint } from "./client.mjs";

const scenario = process.argv[2] ?? "security-failure";
const slow = process.argv.includes("--slow");
const context = graphflowContext();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerWorkflow() {
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
    const fingerprint = await tokenFingerprint(context.token);
    throw new Error(`Workflow registration failed: ${JSON.stringify(body)}\nLocal token fingerprint: ${fingerprint}`);
  }

  console.log("registered workflow graph");
}

async function report(nodeId, status, message) {
  const { response, body } = await graphflowFetch("/api/ingest/gitlab", {
    method: "POST",
    body: JSON.stringify({
      tenantId: context.tenantId,
      projectId: context.projectId,
      workflowId: context.workflowId,
      runId: context.runId,
      nodeId,
      status,
      message,
      commitSha: context.commitSha,
      branch: context.branch,
      actor: context.actor,
      pipelineId: context.runId.replace(/^gitlab_/, ""),
      projectPath: "demo/checkout-service",
    }),
  });

  if (!response.ok) {
    const fingerprint = await tokenFingerprint(context.token);
    throw new Error(`Node report failed for ${nodeId}: ${JSON.stringify(body)}\nLocal token fingerprint: ${fingerprint}`);
  }

  console.log(`${nodeId.padEnd(16)} ${status.padEnd(8)} ${message}`);

  if (slow) {
    await wait(800);
  }
}

async function gate() {
  const query = new URLSearchParams({
    tenantId: context.tenantId,
    projectId: context.projectId,
    workflowId: context.workflowId,
    failOn: "FAIL",
  });
  const { response, body } = await graphflowFetch(`/api/runs/${encodeURIComponent(context.runId)}/gate?${query.toString()}`);

  console.log(`gate status: ${response.status}`);
  console.log(`gate verdict: ${body.gate?.verdict}`);
  console.log(`gate summary: ${body.gate?.summary}`);

  return response.ok;
}

async function compliance() {
  const query = new URLSearchParams({
    tenantId: context.tenantId,
    projectId: context.projectId,
    workflowId: context.workflowId,
  });
  const { response, body } = await graphflowFetch(`/api/runs/${encodeURIComponent(context.runId)}/compliance?${query.toString()}`);

  console.log(`compliance export: ${response.status}`);
  console.log(`audit events persisted: ${body.audit?.events?.length ?? 0}`);
}

async function runScenario() {
  await registerWorkflow();

  await report("build", "success", "GitLab built the checkout service artifact.");
  await report("unit", "success", "Unit tests passed for pricing and checkout validation.");
  await report("integration", "success", "Integration tests passed for high-risk payment step-up.");
  await report("dependency_scan", "success", "Dependency risk scan passed.");

  if (scenario === "security-failure") {
    await report("static_scan", "failed", "Static risk scan found unsafe checkout release pattern.");
    await gate();
    await compliance();
    return;
  }

  await report("static_scan", "success", "Static risk scan passed.");

  if (scenario === "migration-failure") {
    await report("migration_check", "failed", "Migration review found destructive schema risk.");
    await gate();
    await compliance();
    return;
  }

  await report("migration_check", "success", "Database migration review passed.");
  await report("approval", "waiting", "Production approval is waiting for release manager review.");

  if (scenario === "waiting-approval") {
    await gate();
    await compliance();
    return;
  }

  await report("approval", "success", "Production approval granted.");
  await report("staging", "success", "Staging deployment completed.");
  await report("smoke", "success", "Smoke tests passed in staging.");
  await report("canary", "success", "Canary deployment completed.");
  await report("prod", "success", "Production deployment completed.");
  await gate();
  await compliance();
}

console.log(`GraphFlow scenario: ${scenario}`);
console.log(`Run ID: ${context.runId}`);
console.log(`Dashboard: ${dashboardUrl(context)}`);

try {
  await runScenario();
  console.log(`Open dashboard: ${dashboardUrl(context)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
