#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-graphflow-foundation}"

echo "Deploying GraphFlow AWS foundation"
echo "region: $AWS_REGION"
echo "stack:  $STACK_NAME"

aws cloudformation deploy \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$ROOT_DIR/infra/graphflow-foundation.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName=graphflow \
    RunsTableName=GraphFlowRuns \
    EventBusName=graphflow-events

echo
aws cloudformation describe-stacks \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs" \
  --output table
