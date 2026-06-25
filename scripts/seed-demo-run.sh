#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
RUN_ID="${RUN_ID:-run_demo_001}"
TABLE_NAME="${TABLE_NAME:-GraphFlowRuns}"

put_item() {
  local sk="$1"
  local status="$2"
  local node_id="$3"
  local message="$4"

  aws dynamodb put-item \
    --region "$AWS_REGION" \
    --table-name "$TABLE_NAME" \
    --item "{
      \"pk\": {\"S\": \"$RUN_ID\"},
      \"sk\": {\"S\": \"$sk\"},
      \"workflowId\": {\"S\": \"release-command-center\"},
      \"nodeId\": {\"S\": \"$node_id\"},
      \"status\": {\"S\": \"$status\"},
      \"message\": {\"S\": \"$message\"}
    }"
}

aws dynamodb put-item \
  --region "$AWS_REGION" \
  --table-name "$TABLE_NAME" \
  --item "{
    \"pk\": {\"S\": \"$RUN_ID\"},
    \"sk\": {\"S\": \"META\"},
    \"workflowId\": {\"S\": \"release-command-center\"},
    \"status\": {\"S\": \"running\"},
    \"message\": {\"S\": \"Demo release run seeded from CLI.\"}
  }"

put_item "NODE#build" "success" "build" "Build completed."
put_item "NODE#unit" "success" "unit" "Unit Tests completed."
put_item "NODE#scan" "failed" "scan" "Security Scan failed."
put_item "NODE#approval" "blocked" "approval" "Blocked by Security Scan."
put_item "NODE#prod" "blocked" "prod" "Production deploy blocked by upstream dependency."

echo "Seeded DynamoDB demo run: $RUN_ID"
aws dynamodb query \
  --region "$AWS_REGION" \
  --table-name "$TABLE_NAME" \
  --key-condition-expression "pk = :pk" \
  --expression-attribute-values "{\":pk\":{\"S\":\"$RUN_ID\"}}" \
  --output table
