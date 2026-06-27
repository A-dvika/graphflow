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

  console.log(`${nodeId.padEnd(22)} ${status.padEnd(8)} ${message}`);

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
  await report("checkout_integration", "success", "Checkout integration tests passed across cart, wallet, and order APIs.");
  await report("pricing_contract", "success", "Pricing contract tests passed against promotions and tax service.");
  await report("payment_contract", "success", "Payment provider contract passed for auth, capture, and refund flows.");
  await report("inventory_contract", "success", "Inventory reservation contract passed for checkout hold lifecycle.");
  await report("dependency_scan", "success", "Dependency risk scan passed.");
  await report("pci_scan", "success", "PCI controls passed for payment data handling.");
  await report("fraud_model_check", "success", "Fraud model compatibility passed for step-up decisions.");

  if (scenario === "security-failure") {
    await report("static_scan", "failed", "Static risk scan found unsafe release pattern in checkout authorization path.");
    await gate();
    await compliance();
    return;
  }

  await report("static_scan", "success", "Static risk scan passed.");
  await report("risk_review", "success", "Release risk review accepted security and domain risk evidence.");

  if (scenario === "migration-failure") {
    await report("migration_check", "failed", "Migration review found high-cardinality index and backfill risk.");
    await gate();
    await compliance();
    return;
  }

  await report("migration_check", "success", "Database migration review passed for payment audit schema.");
  await report("backfill_check", "success", "Backfill load check passed under production-like checkout volume.");
  await report("rollback_plan", "success", "Rollback plan validated for schema and feature flag rollback.");
  await report("approval", "waiting", "Production approval is waiting for release manager review.");

  if (scenario === "waiting-approval") {
    await gate();
    await compliance();
    return;
  }

  await report("approval", "success", "Production approval granted.");
  await report("staging", "success", "Staging deployment completed.");
  await report("e2e", "success", "End-to-end checkout tests passed in staging.");
  await report("canary", "success", "Canary deployment completed.");
  await report("canary_metrics", "success", "Canary metrics stayed within checkout error budget.");
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
