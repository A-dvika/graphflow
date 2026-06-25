# Backend Development

GraphFlow backend now has three responsibilities:

1. Read release run state from DynamoDB.
2. Accept CI/CD status updates through an ingest API.
3. Register workflow graph configs for project onboarding.
4. Run deterministic graph analysis for blockers, downstream impact, and critical path.

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
DATABASE_URL=<Aurora PostgreSQL connection string>
DATABASE_POOL_MAX=3
```

Do not commit these values.

## API Routes

Read the seeded run:

```text
GET /api/runs/run_demo_001
```

Read workflow graph:

```text
GET /api/workflows/release-template
```

This route tries Aurora PostgreSQL first when `DATABASE_URL` is configured. If Aurora is not
configured or the workflow is missing, it falls back to DynamoDB/static demo data.

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
GraphFlow reporting stage.

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
