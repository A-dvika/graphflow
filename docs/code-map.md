# GraphFlow Code Map

This document explains the major functions, components, API routes, and demo scripts in GraphFlow.

It is meant for code review and product review, not as a formal API reference.

## App Shell

### `src/app/page.tsx`

Exports:

```text
Home()
```

Role:

Top-level client page. Holds the active console section state and renders:

- `AppSidebar`
- `AppHeader`
- `Dashboard`

Important behavior:

- Sidebar selection controls which dashboard section is visible.
- Section metadata comes from `src/lib/console-sections.ts`.

### `src/app/layout.tsx`

Exports:

```text
RootLayout()
```

Role:

Next.js root layout. Defines global fonts and wraps the app HTML/body.

## Console Section Model

### `src/lib/console-sections.ts`

Exports:

- `ConsoleSection`
- `ConsoleSectionMeta`
- `primaryConsoleSections`
- `secondaryConsoleSections`
- `allConsoleSections`
- `getConsoleSectionMeta(section)`

Role:

Single source of truth for the left navigation and page titles.

Sections:

- Overview
- Releases
- Deployments
- Quality Gates
- Analytics
- Logs
- Settings
- Documentation

## Main UI Components

### `src/components/app-sidebar.tsx`

Exports:

```text
AppSidebar()
```

Role:

Left navigation. Receives:

- `activeSection`
- `onSectionChange`

Why it matters:

This changed the app from dummy `#` links into real console navigation.

### `src/components/app-header.tsx`

Exports:

```text
AppHeader()
```

Role:

Top header with search affordance, active section badge, and quick links.

Behavior:

- Help icon opens Documentation.
- Bell icon opens Logs.
- Settings icon opens Settings.

### `src/components/dashboard.tsx`

Exports:

```text
Dashboard()
```

Role:

Main product surface.

Backend calls:

- `GET /api/runs/{runId}/overview`
- `GET /api/projects/{projectId}/runs`
- `GET /api/system/health`
- `POST /api/runs/{runId}/actions`

Important helpers:

- `verdictStyles()`: maps gate verdict to UI colors.
- `statusLabel()`: converts statuses into readable labels.
- `statusTone()`: maps statuses/verdicts to UI color classes.
- `runHealth()`: summarizes a run into ready/running/waiting/blocked.
- `formatSource()`: makes backend source names readable.
- `nodeTypeLabel()`: formats node types.
- `formatDate()`: formats recent run timestamps.
- `metricCard()`: reusable stat card rendering helper.
- `statusBadge()`: compact status badge helper.
- `runAction()`: calls backend demo actions.

Dashboard render sections:

- `renderOverview()`: graph-first command center with gate, stats, graph, agent insight.
- `renderReleases()`: active release details and recent runs.
- `renderDeployments()`: deployment path and environment nodes.
- `renderQualityGates()`: gate verdict, policy evidence, required nodes.
- `renderAnalytics()`: critical path, migration risk, bottlenecks, release flow distribution.
- `renderLogs()`: run event timeline and backend sources.
- `renderSettings()`: AWS/Aurora/workflow/agent runtime health.
- `renderDocumentation()`: integration API surface and architecture summary.
- `renderAgentCard()`: deterministic or LLM-backed release explanation.
- `renderSelectedNodeCard()`: selected graph node details.
- `renderSection()`: switches between console sections.

Important behavior:

Dashboard can load any run via URL query params:

```text
?tenantId=demo&projectId=checkout-service&workflowId=checkout-release-v1&runId=...
```

### `src/components/release-flow-graph.tsx`

Exports:

```text
ReleaseFlowGraph()
```

Role:

Graph visualization for workflow nodes and edges.

Inputs:

- nodes
- edges
- statuses
- critical path
- blast radius
- selected node
- select callback

Important helpers:

- `edgeKey(edge)`: stable React key for graph edges.
- `edgeInPath(edge, path)`: detects if an edge belongs to critical path.
- `nodeTypeLabel(type)`: formats node type.

Visual behavior:

- SVG lines render dependencies.
- Node cards are positioned by `x/y`.
- Critical path edges are highlighted.
- Blast-radius nodes/edges are visually emphasized.
- Clicking a node updates selected-node details.

## Legacy / Supporting Components

These exist from earlier UI iterations and are less central now:

- `src/components/event-timeline.tsx`
- `src/components/gate-panel.tsx`
- `src/components/header.tsx`
- `src/components/quality-gates-dashboard.tsx`
- `src/components/release-card.tsx`
- `src/components/release-graph-d3.tsx`
- `src/components/sidebar.tsx`

Recommendation:

Before final submission, either remove unused legacy components or clearly keep them as alternate
prototype components. The active app path uses `AppSidebar`, `AppHeader`, `Dashboard`, and
`ReleaseFlowGraph`.

## UI Primitives

Located in:

```text
src/components/ui/
```

Components:

- Alert
- Badge
- Button
- Card
- Input
- Progress
- Select
- SimpleButton
- Tabs
- Tooltip

Role:

Reusable primitives from the UI scaffold. They are mostly styling wrappers around Base UI and
standard HTML elements.

## Backend Model

### `src/lib/backend/model.ts`

Exports:

- Zod schemas for request validation.
- default IDs.
- key-builder functions.
- identity normalization helpers.

Important functions:

### `normalizeProjectId(projectId, projectPath)`

Converts user/project input into a safe project ID.

Example:

```text
Advika/Checkout Service -> advika-checkout-service
```

### `buildRunIdentity(input)`

Creates the canonical `RunIdentity`.

Defaults:

- tenant: `demo`
- project: `graphflow`
- workflow: `release-command-center`
- run: `run_demo_001`

If `pipelineId` exists and `runId` is missing:

```text
runId = gitlab_{pipelineId}
```

### Key helpers

- `runPartitionKey(identity)`
- `legacyRunPartitionKey(runId)`
- `projectRunsPartitionKey(identity)`
- `projectRunSortKey(updatedAt, runId)`
- `projectPartitionKey(identity)`
- `workflowSortKey(workflowId)`
- `policySortKey(policyId)`

These define DynamoDB partition/sort key strategy.

### `normalizeStatus(value)`

Validates unknown status strings and falls back to `pending`.

### `ttlFromNow(days)`

Computes DynamoDB TTL timestamps.

## Graph Algorithms

### `src/lib/graphflow.ts`

Exports:

- `Status`
- `FlowNode`
- `FlowEdge`
- `releaseNodes`
- `releaseEdges`
- `initialStatuses`
- `findCriticalPath()`
- `downstreamOf()`
- `analyzeRun()`

See:

```text
docs/data-structures-and-algorithms.md
```

## Gate And Policy

### `src/lib/backend/gate.ts`

Exports:

- `GateVerdict`
- `GateDecision`
- `graphNodesForGate()`
- `evaluateReleaseGate()`

### `graphNodesForGate(nodes)`

Normalizes partial workflow nodes into full graph nodes.

Why it exists:

Registered workflow configs may omit `type`, `duration`, `x`, or `y`. The gate/UI need all fields.

### `evaluateReleaseGate(input)`

Deterministic release decision engine.

Uses:

- graph nodes
- graph edges
- run statuses
- release policy
- migration risk
- critical path
- blast radius

Returns:

- `PASS`
- `WARN`
- `FAIL`

### `src/lib/backend/policy.ts`

Exports:

- `ReleasePolicy`
- `defaultReleasePolicy`
- `normalizeReleasePolicy()`
- `policyRequiresNode()`

### `normalizeReleasePolicy(input)`

Fills missing policy fields with defaults.

### `policyRequiresNode(policy, node)`

Returns true when a node type is required by the policy.

### `src/lib/backend/migration-risk.ts`

Exports:

- `MigrationRiskLevel`
- `MigrationRisk`
- `analyzeMigrationRisk()`

### `analyzeMigrationRisk(input)`

Classifies migration-related graph nodes as `none`, `low`, `medium`, or `high`.

## Auth

### `src/lib/backend/auth.ts`

Exports:

```text
requireIngestAuth()
```

Role:

Protects ingest/gate/admin routes with `GRAPHFLOW_INGEST_TOKEN`.

Behavior:

- no configured token means auth is disabled
- matching bearer token allows request
- mismatch returns `401`
- mismatch includes safe token fingerprints for debugging

## AWS Data Access

### `src/lib/aws/dynamodb.ts`

Exports:

- `ReleaseRun`
- `ReleaseRunSummary`
- `hasAwsConfig()`
- `getDocumentClient()`
- `buildActionSnapshot()`
- `getDemoRun()`
- `getRunFromDynamoDB()`
- `listProjectRuns()`
- `publishRunEvent()`
- `putRunSnapshot()`
- `putRunNodeState()`
- `ingestNodeState()`
- `applyRunAction()`

Important internal helpers:

- `runStatusFromNodes()`: summarizes node statuses for run list.
- `itemIdentity()`: reconstructs identity from stored items.
- `materializeRun()`: converts DynamoDB items into `ReleaseRun`.

### `buildActionSnapshot(action)`

Creates deterministic demo run snapshots for:

- reset
- start
- fail-security
- approve

### `getRunFromDynamoDB(run)`

Loads run state from DynamoDB. Falls back to static demo run if AWS is not configured or no items
exist.

### `listProjectRuns(input)`

Reads recent runs through the DynamoDB GSI.

### `putRunSnapshot(input)`

Writes a full run snapshot:

- `META`
- all node status items
- EventBridge event
- Aurora audit event

### `putRunNodeState(input)`

Writes one node state update and audit/event evidence.

### `ingestNodeState(input)`

Writes one node state. If the node failed, it marks downstream nodes as `blocked` using the
workflow edges passed in.

This is the function that makes GraphFlow useful beyond plain CI/CD status lists.

### `applyRunAction(input)`

Applies one demo action by writing a snapshot.

### `src/lib/aws/workflows.ts`

Exports:

- `getFallbackWorkflow()`
- `putWorkflowConfig()`
- `getWorkflowConfig()`

### `putWorkflowConfig(input)`

Stores registered workflow config in DynamoDB.

### `getWorkflowConfig(input)`

Resolution order:

1. Try Aurora graph by workflow ID.
2. Try DynamoDB registered workflow config.
3. Fall back to static demo workflow.

### `src/lib/aws/policies.ts`

Exports:

- `getReleasePolicy()`
- `putReleasePolicy()`

### `getReleasePolicy(input)`

Loads org policy from DynamoDB, or returns default policy.

### `putReleasePolicy(input)`

Validates and stores org policy in DynamoDB.

### `src/lib/aws/aurora.ts`

Exports:

- `AuditEventInput`
- `AuditEvent`
- `hasAuroraDataApiConfig()`
- `probeAuroraDataApi()`
- `getWorkflowFromAurora()`
- `writeAuditEventToAurora()`
- `getAuditEventsFromAurora()`

Important internal helpers:

- `getDataApiConfig()`: reads RDS Data API env.
- `getDataApiClient()`: creates RDS Data API client.
- `safeAwsError()`: returns non-secret error info.
- `getPool()`: direct Postgres fallback.
- `normalizeNodeType()`: validates node types from DB.
- `stringField()`, `numberField()`, `parseJsonField()`: map RDS Data API field shapes.
- `getWorkflowFromAuroraDataApi()`: reads graph through RDS Data API.
- `getWorkflowFromAuroraPg()`: reads graph through direct Postgres connection.

### `getWorkflowFromAurora(workflowId)`

Resolution order:

1. Aurora Data API.
2. Direct Postgres fallback.
3. `null`.

### `writeAuditEventToAurora(input)`

Writes compliance/audit evidence to Aurora when configured.

### `getAuditEventsFromAurora(identity)`

Reads persisted audit evidence for compliance export.

## Agent Layer

### `src/lib/agent/llm.ts`

Exports:

- `LlmProvider`
- `LlmRequest`
- `LlmResult`
- `getAgentConfig()`
- `completeWithAgentModel()`

Providers:

- `none`
- `gemma-http`
- `ollama`

Important helpers:

- `providerFromEnv()`: reads provider env.
- `safeError()`: strips sensitive error detail.
- `extractText()`: normalizes provider response shapes.
- `postJson()`: calls HTTP LLM endpoint.

### `completeWithAgentModel(request)`

Calls configured LLM provider. If no provider is configured, returns a deterministic no-text result.

### `src/lib/agent/release-agent.ts`

Exports:

- `ReleaseAgentInsight`
- `generateReleaseInsight()`

Internal helpers:

- `labelsFor()`: maps node IDs to labels.
- `deterministicInsight()`: fallback explanation.
- `parseAgentJson()`: extracts strict JSON from model output.

### `generateReleaseInsight(input)`

Builds a prompt from graph, statuses, and gate decision. Uses the LLM when configured; otherwise
returns deterministic insight.

## API Routes

### `GET /api/system/health`

File:

```text
src/app/api/system/health/route.ts
```

Checks:

- AWS config
- Aurora config
- Aurora workflow probe
- fallback workflow source

### `GET /api/workflows/release-template`

Returns the active release workflow graph.

### `POST /api/workflows/register`

Protected by ingest token.

Registers a workflow config from a project.

Used by:

- demo checkout repo
- future GitLab onboarding

### `POST /api/ingest/gitlab`

Protected by ingest token.

Accepts CI job/node status updates.

Flow:

1. Validate request body.
2. Build run identity.
3. Load workflow edges.
4. Write node state.
5. If failed, block downstream nodes.
6. Persist audit/event evidence.

### `GET /api/projects/{projectId}/runs`

Returns recent runs for one project.

### `GET /api/runs/{runId}`

Returns basic run state.

### `POST /api/runs/start`

Protected by ingest token.

Starts a demo run snapshot.

### `POST /api/runs/{runId}/actions`

Applies dashboard actions:

- reset
- start
- fail-security
- approve

### `GET /api/runs/{runId}/overview`

Public dashboard endpoint.

Combines:

- DynamoDB run
- workflow graph
- release policy
- gate decision
- agent insight

### `GET /api/runs/{runId}/gate`

Protected by ingest token.

Used by CI/CD to decide whether production should continue.

Returns:

- HTTP `200` when pass/not blocked.
- HTTP `409` when GraphFlow should block release.

### `GET /api/runs/{runId}/agent`

Protected by ingest token.

Returns release agent explanation for a run.

### `GET /api/runs/{runId}/compliance`

Protected by ingest token.

Returns compliance-style release evidence:

- graph summary
- gate decision
- policy snapshot
- migration risk
- run state
- Aurora audit events
- SOC 2/PCI-style evidence flags

### `GET /api/policies/{policyId}`

Returns release policy.

### `PUT /api/policies/{policyId}`

Protected by ingest token.

Creates or updates org-level release policy.

## Demo Checkout Repo

Location:

```text
demo-repos/checkout-service
```

### `graphflow/client.mjs`

Exports:

- `graphflowContext()`
- `graphflowFetch()`
- `dashboardUrl()`
- `tokenFingerprint()`

Role:

Shared client for demo scripts.

### `graphflow/register-workflow.mjs`

Registers `graphflow/graphflow.config.json` with GraphFlow.

### `graphflow/report-node.mjs`

Reports one node status to GraphFlow.

Used by GitLab CI `before_script` and `after_script`.

### `graphflow/release-gate.mjs`

Calls GraphFlow gate endpoint and exits non-zero if GraphFlow blocks production.

### `graphflow/demo-pipeline.mjs`

Creates a live demo run without waiting for GitLab runners.

Scenarios:

- `security-failure`
- `migration-failure`
- `waiting-approval`
- `success`

### `.gitlab-ci.yml`

Realistic CI pipeline:

- build
- tests
- security
- migration review
- approval
- staging
- smoke
- canary
- gate
- production

## Known Review Targets For Tomorrow

Good places to improve next:

- Make `analyzeRun` accept custom graph nodes/edges.
- Add idempotency to `POST /api/ingest/gitlab`.
- Add a UI control to paste/run a demo scenario from the dashboard.
- Add visible compliance export download button.
- Apply Aurora schema update in deployment automatically.
- Remove or archive legacy unused UI components.
- Add unit tests for `findCriticalPath`, `downstreamOf`, `evaluateReleaseGate`, and migration risk.

