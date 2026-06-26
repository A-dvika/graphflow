# Backend Development

GraphFlow backend now has four responsibilities:

1. Read release run state from DynamoDB.
2. Accept CI/CD status updates through an ingest API.
3. Register workflow graph configs for project onboarding.
4. Run deterministic graph analysis for blockers, downstream impact, and critical path.
5. Evaluate release gates that GitLab can require before deployment.
6. Generate optional agentic release explanations through a swappable LLM provider.

## Runtime Environment

For local development without AWS variables, the backend returns demo fallback data.

For deployed Vercel API routes to read DynamoDB, add these environment variables in Vercel project
settings:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1
GRAPHFLOW_RUNS_TABLE=GraphFlowRuns
GRAPHFLOW_EVENT_BUS=graphflow-events
GRAPHFLOW_INGEST_TOKEN=<random shared secret for CI ingest>
GRAPHFLOW_RUN_RETENTION_DAYS=30
AURORA_CLUSTER_ARN=<Aurora cluster ARN>
AURORA_SECRET_ARN=<Aurora managed secret ARN>
AURORA_DATABASE_NAME=graphflow
GRAPHFLOW_AGENT_PROVIDER=none
GRAPHFLOW_LLM_ENDPOINT=<optional Gemma/OpenAI-compatible/Ollama endpoint>
GRAPHFLOW_LLM_MODEL=gemma
GRAPHFLOW_LLM_API_KEY=<optional provider key>
GRAPHFLOW_LLM_TIMEOUT_MS=7000
```

Do not commit these values.

`DATABASE_URL` and `DATABASE_POOL_MAX` are still supported for local/direct PostgreSQL access, but
the recommended deployed path is the RDS Data API variables above. That lets Vercel read the private
Aurora graph without opening database network access.

The agent layer is optional. Use `GRAPHFLOW_AGENT_PROVIDER=none` for deterministic-only behavior.
For the MVP, `gemma-http` can point at a free Gemma-compatible hosted endpoint, while `ollama` can
point at a local/self-hosted Gemma runtime. Later, the same interface can point at a paid managed
endpoint without changing the release gate contract.

## API Routes

Read the seeded run:

```text
GET /api/runs/run_demo_001
```

Read workflow graph:

```text
GET /api/workflows/release-template
```

This route tries Aurora through the RDS Data API first when `AURORA_CLUSTER_ARN` and
`AURORA_SECRET_ARN` are configured. It can also use direct PostgreSQL through `DATABASE_URL`. If
Aurora is not configured or the workflow is missing, it falls back to DynamoDB/static demo data.

List recent runs for a project:

```text
GET /api/projects/graphflow/runs
```

Register a project workflow graph:

```text
POST /api/workflows/register
```

Example payload:

```json
{
  "tenantId": "demo",
  "projectId": "graphflow",
  "workflowId": "release-command-center",
  "name": "Production Release",
  "nodes": [
    { "id": "build", "label": "Build", "source": "gitlab:build" },
    { "id": "scan", "label": "Security Scan", "source": "gitlab:security_scan" }
  ],
  "edges": [["build", "scan"]]
}
```

Start a run:

```text
POST /api/runs/start
```

Apply an action to the demo run:

```text
POST /api/runs/run_demo_001/actions
```

Supported actions:

```json
{ "action": "reset" }
{ "action": "start" }
{ "action": "fail-security" }
{ "action": "approve" }
```

Ingest a GitLab CI node update:

```text
POST /api/ingest/gitlab
```

Example payload:

```json
{
  "tenantId": "demo",
  "projectId": "graphflow",
  "pipelineId": "12345",
  "nodeId": "scan",
  "status": "failed",
  "message": "Security Scan failed."
}
```

If a node is ingested as `failed`, GraphFlow writes downstream nodes as `blocked`.

Evaluate a release gate:

```text
GET /api/runs/<runId>/gate?projectId=<projectId>&failOn=FAIL
```

The route returns HTTP `200` when the release can continue and HTTP `409` when GraphFlow decides
the release should be blocked. GitLab can call this in a required job before production deploy.

Example response:

```json
{
  "ok": false,
  "gate": {
    "verdict": "FAIL",
    "shouldBlock": true,
    "summary": "Release gate failed. Production should not continue.",
    "blastRadius": ["approval", "staging", "smoke", "prod"]
  }
}
```

Generate an agentic release explanation:

```text
GET /api/runs/<runId>/agent?projectId=<projectId>&failOn=FAIL
```

This route uses the same deterministic gate decision, then asks the configured model for a concise
explanation and next-action list. If no model is configured, the model times out, or the response is
not valid JSON, GraphFlow returns a deterministic fallback insight. The release gate itself should
stay deterministic and fast; model calls are explanation/advisory only.

Agent providers:

```text
GRAPHFLOW_AGENT_PROVIDER=none        # default deterministic fallback
GRAPHFLOW_AGENT_PROVIDER=gemma-http  # OpenAI-compatible or generic hosted Gemma HTTP endpoint
GRAPHFLOW_AGENT_PROVIDER=ollama      # self-hosted/local Ollama Gemma endpoint
```

If `GRAPHFLOW_INGEST_TOKEN` is configured, external ingest endpoints require:

```text
Authorization: Bearer <GRAPHFLOW_INGEST_TOKEN>
```

The demo dashboard action route is intentionally left callable for the hackathon demo. In a
production version, this would move behind user/session authentication.

## UI Integration

The dashboard buttons now call backend routes:

- **Start Release** -> `POST /api/runs/run_demo_001/actions` with `start`
- **Inject Failure** -> `POST /api/runs/run_demo_001/actions` with `fail-security`
- **Approve** -> `POST /api/runs/run_demo_001/actions` with `approve`
- **Reset** -> `POST /api/runs/run_demo_001/actions` with `reset`
- **Load Backend Run** -> `GET /api/runs/run_demo_001`

When AWS variables are present, these actions write run snapshots to DynamoDB and publish a
GraphFlow event to EventBridge. Without AWS variables, they return deterministic fallback data for
local development.

## Example GitLab Project Integration

A project that wants a GraphFlow dashboard can add a reporting job:

```yaml
graphflow_report:
  stage: report
  image: curlimages/curl:latest
  script:
    - |
      curl -X POST "$GRAPHFLOW_INGEST_URL/api/ingest/gitlab" \
        -H "Content-Type: application/json" \
        -d "{
          \"pipelineId\": \"$CI_PIPELINE_ID\",
          \"nodeId\": \"scan\",
          \"status\": \"failed\",
          \"message\": \"Security Scan failed in GitLab CI.\"
        }"
```

For the hackathon, this proves the onboarding model: teams keep their existing CI/CD and add a
GraphFlow reporting stage plus a release gate job. In a real rollout, the release gate job becomes a
protected required stage before production deployment.

See:

- `examples/gitlab-ci-graphflow.yml`
- `examples/graphflow.config.json`

## DynamoDB Access Patterns

`GraphFlowRuns` uses a single-table design.

Workflow config:

```text
pk = TENANT#<tenantId>#PROJECT#<projectId>
sk = WORKFLOW#<workflowId>
```

## Aurora PostgreSQL Graph Storage

Aurora PostgreSQL stores the durable workflow graph:

```text
workflows
workflow_nodes
workflow_edges
workflow_graph view
```

Apply the schema after creating the Aurora PostgreSQL database:

```bash
export DATABASE_URL='postgres://user:password@host:5432/graphflow?sslmode=require'
bash scripts/apply-aurora-schema.sh
```

CI/CD alternative:

```bash
bash scripts/deploy-aurora.sh
bash scripts/bootstrap-aurora-data-api.sh
```

In GitLab, this is exposed as the manual `deploy_aurora_graph` job.

The deployed app reads this schema through the RDS Data API. Add these Vercel runtime variables from
the Aurora stack outputs:

```text
AURORA_CLUSTER_ARN
AURORA_SECRET_ARN
AURORA_DATABASE_NAME=graphflow
```

Direct run lookup:

```text
pk = TENANT#<tenantId>#PROJECT#<projectId>#RUN#<runId>
sk = META | NODE#<nodeId>
```

Recent runs by project:

```text
gsi1pk = TENANT#<tenantId>#PROJECT#<projectId>
gsi1sk = RUN#<updatedAt>#<runId>
```

The table is on-demand and writes `expiresAt` retention timestamps. Managed DynamoDB TTL can be
enabled later, but the hackathon stack keeps TTL out of CloudFormation to avoid extra IAM friction.

## Useful Commands

Query the seeded run from Git Bash:

```bash
aws dynamodb query \
  --region us-east-1 \
  --table-name GraphFlowRuns \
  --key-condition-expression "pk = :pk" \
  --expression-attribute-values '{":pk":{"S":"TENANT#demo#PROJECT#graphflow#RUN#run_demo_001"}}'
```

List recent runs for the demo project through the GSI:

```bash
aws dynamodb query \
  --region us-east-1 \
  --table-name GraphFlowRuns \
  --index-name gsi1 \
  --key-condition-expression "gsi1pk = :pk" \
  --expression-attribute-values '{":pk":{"S":"TENANT#demo#PROJECT#graphflow"}}'
```
