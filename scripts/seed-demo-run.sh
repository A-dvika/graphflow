#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
RUN_ID="${RUN_ID:-run_demo_001}"
TABLE_NAME="${TABLE_NAME:-GraphFlowRuns}"
TENANT_ID="${TENANT_ID:-demo}"
PROJECT_ID="${PROJECT_ID:-graphflow}"
WORKFLOW_ID="${WORKFLOW_ID:-release-command-center}"
UPDATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
EXPIRES_AT="$(($(date +%s) + 30 * 24 * 60 * 60))"
PK="TENANT#$TENANT_ID#PROJECT#$PROJECT_ID#RUN#$RUN_ID"
GSI1PK="TENANT#$TENANT_ID#PROJECT#$PROJECT_ID"
GSI1SK="RUN#$UPDATED_AT#$RUN_ID"

put_item() {
  local sk="$1"
  local status="$2"
  local node_id="$3"
  local message="$4"

  aws dynamodb put-item \
    --region "$AWS_REGION" \
    --table-name "$TABLE_NAME" \
    --item "{
      \"pk\": {\"S\": \"$PK\"},
      \"sk\": {\"S\": \"$sk\"},
      \"tenantId\": {\"S\": \"$TENANT_ID\"},
      \"projectId\": {\"S\": \"$PROJECT_ID\"},
      \"workflowId\": {\"S\": \"$WORKFLOW_ID\"},
      \"runId\": {\"S\": \"$RUN_ID\"},
      \"nodeId\": {\"S\": \"$node_id\"},
      \"status\": {\"S\": \"$status\"},
      \"message\": {\"S\": \"$message\"},
      \"updatedAt\": {\"S\": \"$UPDATED_AT\"},
      \"expiresAt\": {\"N\": \"$EXPIRES_AT\"}
    }"
}

aws dynamodb put-item \
  --region "$AWS_REGION" \
  --table-name "$TABLE_NAME" \
  --item "{
    \"pk\": {\"S\": \"$PK\"},
    \"sk\": {\"S\": \"META\"},
    \"gsi1pk\": {\"S\": \"$GSI1PK\"},
    \"gsi1sk\": {\"S\": \"$GSI1SK\"},
    \"tenantId\": {\"S\": \"$TENANT_ID\"},
    \"projectId\": {\"S\": \"$PROJECT_ID\"},
    \"workflowId\": {\"S\": \"$WORKFLOW_ID\"},
    \"runId\": {\"S\": \"$RUN_ID\"},
    \"status\": {\"S\": \"blocked\"},
    \"message\": {\"S\": \"Demo release run seeded from CLI.\"},
    \"updatedAt\": {\"S\": \"$UPDATED_AT\"},
    \"expiresAt\": {\"N\": \"$EXPIRES_AT\"}
  }"

put_item "NODE#build" "success" "build" "Build completed."
put_item "NODE#unit" "success" "unit" "Unit Tests completed."
put_item "NODE#scan" "failed" "scan" "Security Scan failed."
put_item "NODE#approval" "blocked" "approval" "Blocked by Security Scan."
put_item "NODE#staging" "blocked" "staging" "Staging deploy blocked by Security Scan."
put_item "NODE#smoke" "blocked" "smoke" "Smoke Test blocked by Security Scan."
put_item "NODE#prod" "blocked" "prod" "Production deploy blocked by upstream dependency."

echo "Seeded DynamoDB demo run: $RUN_ID"
aws dynamodb query \
  --region "$AWS_REGION" \
  --table-name "$TABLE_NAME" \
  --key-condition-expression "pk = :pk" \
  --expression-attribute-values "{\":pk\":{\"S\":\"$PK\"}}" \
  --output table
