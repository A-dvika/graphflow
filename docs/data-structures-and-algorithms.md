# GraphFlow Data Structures And Algorithms

This document explains the core data structures and algorithms used by GraphFlow.

## Core Idea

GraphFlow represents a release as a directed dependency graph.

```text
node = one release step
edge = one dependency between release steps
run state = current status of each node
gate = deterministic policy decision over graph + run state
```

GitLab or another CI/CD system still runs the actual jobs. GraphFlow ingests job events and reasons
over the release graph.

## Main Data Structures

### Status

Defined in:

```text
src/lib/graphflow.ts
```

```ts
type Status = "pending" | "running" | "success" | "failed" | "blocked" | "waiting";
```

Meaning:

- `pending`: node has not started.
- `running`: CI/CD reports the job is currently running.
- `success`: node completed successfully.
- `failed`: node failed directly.
- `blocked`: node did not fail itself, but cannot continue because an upstream dependency failed.
- `waiting`: node is waiting on a manual approval or human gate.

### FlowNode

```ts
type FlowNode = {
  id: string;
  label: string;
  type: "compute" | "quality" | "security" | "approval" | "deploy";
  duration: number;
  x: number;
  y: number;
};
```

Fields:

- `id`: stable machine-readable node ID.
- `label`: human-readable UI label.
- `type`: semantic release role used by policy evaluation.
- `duration`: planned duration in minutes, used for critical path analysis.
- `x`, `y`: graph canvas position from 0 to 100.

### FlowEdge

```ts
type FlowEdge = {
  from: string;
  to: string;
};
```

An edge means:

```text
to cannot safely continue until from has completed.
```

Example:

```text
static_scan -> approval
```

If `static_scan` fails, `approval` and downstream deploy nodes become unsafe.

### RunIdentity

Defined in:

```text
src/lib/backend/model.ts
```

```ts
type RunIdentity = {
  tenantId: string;
  projectId: string;
  workflowId: string;
  runId: string;
};
```

This is the multi-tenant addressing model.

- `tenantId`: organization boundary.
- `projectId`: repo/project boundary.
- `workflowId`: release graph/template.
- `runId`: one execution of that workflow.

Example:

```text
tenantId=demo
projectId=checkout-service
workflowId=checkout-release-v1
runId=local_checkout_20260626135829
```

### ReleasePolicy

Defined in:

```text
src/lib/backend/policy.ts
```

The policy controls what GraphFlow considers safe for production.

Important fields:

- `requiredNodeTypes`: node types that must succeed before a clean pass.
- `failOnNodeTypes`: failed node types that are production-blocking.
- `warnOnWaitingApproval`: whether waiting approvals should produce `WARN`.
- `blockOnMigrationRisk`: whether migration risk can fail the gate.
- `requireApprovalBeforeDeploy`: whether approval evidence must exist before deploy evidence is accepted.

Default policy:

```text
required: quality, security, approval, deploy
fail-on: security, deploy
block migration risk: true
approval before deploy: true
```

### GateDecision

Defined in:

```text
src/lib/backend/gate.ts
```

The gate is the central decision object returned to the UI and CI/CD.

Important fields:

- `verdict`: `PASS`, `WARN`, or `FAIL`.
- `shouldBlock`: whether CI/CD should stop.
- `summary`: one-line decision.
- `reasons`: deterministic evidence.
- `failedNodes`: nodes that failed directly.
- `blockedNodes`: nodes blocked by upstream failure.
- `waitingNodes`: approvals/manual gates still waiting.
- `blastRadius`: downstream nodes impacted by failures.
- `requiredNodes`: policy-required nodes.
- `criticalPath`: longest planned-duration path.
- `migrationRisk`: database migration risk summary.
- `policy`: policy snapshot used for the decision.

### MigrationRisk

Defined in:

```text
src/lib/backend/migration-risk.ts
```

```ts
type MigrationRiskLevel = "none" | "low" | "medium" | "high";
```

GraphFlow detects migration-related nodes by scanning node IDs and labels for terms such as:

- `migration`
- `schema`
- `database`
- `db`

Risk levels:

- `none`: no migration node found.
- `low`: migration node completed successfully.
- `medium`: migration node is pending, running, or waiting.
- `high`: migration node failed or is blocked.

### Aurora Tables

Defined in:

```text
database/aurora-schema.sql
database/aurora-bootstrap-data-api.sql
```

Core graph tables:

- `workflows`
- `workflow_nodes`
- `workflow_edges`

Enterprise evidence tables:

- `release_audit_events`
- `release_policies`

Views:

- `workflow_graph`
- `release_audit_summary`

### DynamoDB Items

Defined in:

```text
src/lib/aws/dynamodb.ts
```

Primary run partition:

```text
pk = TENANT#{tenantId}#PROJECT#{projectId}#RUN#{runId}
```

Items:

- `sk = META`: run summary.
- `sk = NODE#{nodeId}`: status for one graph node.

Project-run index:

```text
gsi1pk = TENANT#{tenantId}#PROJECT#{projectId}
gsi1sk = RUN#{updatedAt}#{runId}
```

This supports recent-run lists.

## Algorithms

### 1. Critical Path Analysis

Function:

```text
findCriticalPath()
```

File:

```text
src/lib/graphflow.ts
```

Goal:

Find the longest planned-duration dependency path through the release graph.

Why it matters:

The longest path is the release path most likely to delay production. It tells users where time is
actually constrained.

Algorithm:

1. Build adjacency maps:
   - `outgoing`: node -> child nodes
   - `incoming`: node -> parent nodes
2. Compute indegree for every node.
3. Run topological sort with a queue of zero-indegree nodes.
4. If the graph is acyclic, use topological order.
5. If the graph has a cycle or incomplete order, fall back to declared node order.
6. For each node, find the parent with the highest accumulated duration.
7. Store:
   - `score[node] = best parent score + node duration`
   - `previous[node] = best parent`
8. Pick the node with the highest final score.
9. Walk backward through `previous` to reconstruct the path.

Complexity:

```text
O(V + E + P log P)
```

Where:

- `V` = node count.
- `E` = edge count.
- `P` = parent count sorting per node.

For hackathon/demo scale this is trivial. For very large graphs, the parent sort can be replaced
with a linear max scan.

### 2. Downstream Blast Radius

Function:

```text
downstreamOf(nodeId, edges)
```

File:

```text
src/lib/graphflow.ts
```

Goal:

Find every node downstream of a failed node.

Why it matters:

If a security scan fails, GraphFlow can show which approvals, deploys, and validations are no
longer safe.

Algorithm:

1. Start queue with the failed node.
2. While queue is not empty:
   - pop current node
   - find edges where `edge.from === current`
   - add each unseen `edge.to` to result
   - push each unseen child into queue
3. Return the result set.

This is breadth-first traversal over the directed graph.

Complexity:

```text
O(V * E)
```

The current implementation filters the edge list at each step. For very large graphs, build an
adjacency map first and make it `O(V + E)`.

### 3. Run Analysis

Function:

```text
analyzeRun(statuses)
```

File:

```text
src/lib/graphflow.ts
```

Goal:

Produce lightweight operational metadata for a run.

Output:

- critical path
- blocked count
- completed count
- bottleneck node
- recommendation

Current behavior:

- failed node wins as bottleneck
- otherwise waiting node wins
- otherwise no active blocker

Note:

This function currently uses the default demo graph. The gate and UI use custom workflow graph
data where needed. Future work should make `analyzeRun` graph-aware too.

### 4. Release Gate Evaluation

Function:

```text
evaluateReleaseGate()
```

File:

```text
src/lib/backend/gate.ts
```

Goal:

Convert graph state into a deterministic release decision.

Inputs:

- graph nodes
- graph edges
- node statuses
- optional fail threshold
- release policy

Decision rules:

1. Normalize all missing node statuses to `pending`.
2. Collect:
   - failed nodes
   - blocked nodes
   - waiting nodes
   - policy-required nodes
   - incomplete required nodes
   - failed nodes whose type is production-blocking
3. Compute blast radius from failed nodes.
4. Compute migration risk.
5. Build human-readable reasons.
6. Decide verdict:
   - `FAIL` if failed/blocked/policy-failed/high migration risk.
   - `WARN` if waiting/incomplete/medium migration risk.
   - `PASS` otherwise.
7. Convert verdict into `shouldBlock`:
   - `FAIL` always blocks.
   - `WARN` blocks only when `failOn=WARN`.
8. Attach policy and critical path evidence.

Why this matters:

The LLM never decides pass/fail. The gate is deterministic and auditable.

### 5. Migration Risk Analysis

Function:

```text
analyzeMigrationRisk()
```

File:

```text
src/lib/backend/migration-risk.ts
```

Goal:

Add database migration awareness without requiring a full SQL parser yet.

Algorithm:

1. Identify migration-like nodes by ID/label keywords.
2. If none exist, return `none`.
3. If any migration node failed or is blocked, return `high`.
4. If any migration node is waiting/pending/running, return `medium`.
5. If all migration nodes succeeded, return `low`.

Future upgrade:

Parse SQL migrations directly and classify:

- destructive statements
- large table rewrites
- missing rollback
- incompatible ordering
- lock-heavy operations

### 6. Auth Token Fingerprints

Function:

```text
requireIngestAuth()
```

File:

```text
src/lib/backend/auth.ts
```

Goal:

Protect ingest/gate/admin routes with `GRAPHFLOW_INGEST_TOKEN`.

Behavior:

1. If no token is configured server-side, auth is disabled.
2. Otherwise expect:

```text
Authorization: Bearer <token>
```

3. If token matches, allow request.
4. If token does not match, return `401`.
5. The unauthorized response includes safe SHA-256 prefix fingerprints:
   - expected fingerprint
   - received fingerprint

This helps debug token mismatches without exposing secrets.

### 7. Agent Insight Generation

Function:

```text
generateReleaseInsight()
```

File:

```text
src/lib/agent/release-agent.ts
```

Goal:

Explain the deterministic gate decision in plain language.

Flow:

1. Build a strict prompt from graph, statuses, and gate evidence.
2. Ask configured LLM provider if available.
3. Parse strict JSON from the model.
4. If provider is disabled or output is invalid, fall back to deterministic insight.

Important safety property:

The agent explains the gate. It does not decide the gate.

### 8. Live Demo Pipeline Simulation

File:

```text
demo-repos/checkout-service/graphflow/demo-pipeline.mjs
```

Goal:

Create real backend data without waiting for GitLab runners.

Flow:

1. Register workflow graph.
2. Send node status events.
3. Trigger one scenario:
   - security failure
   - migration failure
   - waiting approval
   - success
4. Call release gate.
5. Call compliance export.
6. Print dashboard URL.

This is the fastest way to prove the UI is not dummy.

## Current Scaling Notes

Good already:

- DynamoDB stores live execution state by run partition.
- Aurora stores graph topology and audit evidence.
- Gate evaluation is deterministic and stateless.
- Dashboard reads one run at a time.
- CI/CD integration is API-based and portable.

Needs improvement for millions of events:

- Build adjacency maps once per graph instead of filtering edge arrays.
- Make `analyzeRun` accept custom graph nodes.
- Add idempotency keys for CI event ingestion.
- Add write batching for high-volume node events.
- Add event compaction/snapshots for very long release histories.
- Move org metrics to async aggregation jobs.
- Add pagination for audit/compliance export.

