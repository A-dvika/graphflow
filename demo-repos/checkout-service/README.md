# Checkout Service Demo

This is a realistic demo repository for GraphFlow. It represents a payments-adjacent checkout
service with build, unit tests, integration tests, dependency checks, static risk checks, database
migration review, staging deploy, smoke tests, canary deploy, and production deploy.

The important part: GitLab still runs the pipeline. GraphFlow sits on top as the release
intelligence and quality-gate layer.

## What The Demo Shows

- A normal GitLab pipeline reports every job as a GraphFlow node.
- `graphflow/graphflow.config.json` registers the release workflow graph.
- `graphflow/report-node.mjs` sends job state into GraphFlow.
- `graphflow/release-gate.mjs` calls the GraphFlow gate before production.
- If a security check fails, GraphFlow returns a failed gate and production is blocked.

## GitLab Variables

Create these CI/CD variables in the demo GitLab project:

```text
GRAPHFLOW_URL=https://your-graphflow-deployment.example
GRAPHFLOW_INGEST_TOKEN=<masked GraphFlow ingest token>
```

Optional variable for the failure demo:

```text
DEMO_SECURITY_FAILURE=true
```

When `DEMO_SECURITY_FAILURE=true`, the static risk check fails on purpose so the pipeline can demo
GraphFlow blocking production.

## Demo Flow

1. Push this folder as a standalone GitLab repository.
2. Run the pipeline normally.
3. Open the GraphFlow dashboard link printed by `graphflow_register`.
4. Run again with `DEMO_SECURITY_FAILURE=true`.
5. Show the failed security node, downstream blast radius, and `409` release gate.

The dashboard URL shape is:

```text
https://your-graphflow-deployment.example/?projectId=<project>&workflowId=checkout-release-v1&runId=gitlab_<pipeline>
```

## Local Checks

```bash
npm ci
npm run build
npm test
npm run test:integration
npm run security:deps
npm run security:static
npm run migration:check
```
