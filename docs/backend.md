# Backend Development

GraphFlow backend now has three responsibilities:

1. Read release run state from DynamoDB.
2. Accept CI/CD status updates through an ingest API.
3. Run deterministic graph analysis for blockers, downstream impact, and critical path.

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
```

Do not commit these values.

## API Routes

Read the seeded run:

```text
GET /api/runs/run_demo_001
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
  "pipelineId": "12345",
  "nodeId": "scan",
  "status": "failed",
  "message": "Security Scan failed."
}
```

If a node is ingested as `failed`, GraphFlow writes downstream nodes as `blocked`.

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
