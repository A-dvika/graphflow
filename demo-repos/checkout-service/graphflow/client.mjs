const localRunId = `local_checkout_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

export async function tokenFingerprint(token) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token ?? ""));

  return [...new Uint8Array(bytes)]
    .slice(0, 6)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function graphflowContext() {
  const baseUrl = process.env.GRAPHFLOW_URL ?? process.env.GRAPHFLOW_INGEST_URL;

  if (!baseUrl) {
    throw new Error("GRAPHFLOW_URL is required.");
  }

  if (!process.env.GRAPHFLOW_INGEST_TOKEN) {
    throw new Error("GRAPHFLOW_INGEST_TOKEN is required.");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    token: process.env.GRAPHFLOW_INGEST_TOKEN,
    tenantId: process.env.GRAPHFLOW_TENANT_ID ?? "demo",
    projectId: process.env.GRAPHFLOW_PROJECT_ID ?? process.env.CI_PROJECT_PATH_SLUG ?? "checkout-service",
    workflowId: process.env.GRAPHFLOW_WORKFLOW_ID ?? "checkout-release-v1",
    runId: process.env.GRAPHFLOW_RUN_ID ?? (process.env.CI_PIPELINE_ID ? `gitlab_${process.env.CI_PIPELINE_ID}` : localRunId),
    commitSha: process.env.CI_COMMIT_SHA ?? "local-demo-commit",
    branch: process.env.CI_COMMIT_REF_NAME ?? "demo/main",
    actor: process.env.GITLAB_USER_LOGIN ?? "demo-release-engineer",
  };
}

export async function graphflowFetch(path, init = {}) {
  const context = graphflowContext();
  const response = await fetch(`${context.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${context.token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  return {
    context,
    response,
    body,
  };
}

export function dashboardUrl(context = graphflowContext()) {
  const url = new URL(context.baseUrl);

  url.searchParams.set("tenantId", context.tenantId);
  url.searchParams.set("projectId", context.projectId);
  url.searchParams.set("workflowId", context.workflowId);
  url.searchParams.set("runId", context.runId);

  return url.toString();
}
