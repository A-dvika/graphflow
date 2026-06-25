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
