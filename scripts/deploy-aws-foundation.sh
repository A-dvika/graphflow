#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-graphflow-foundation}"

echo "Deploying GraphFlow AWS foundation"
echo "region: $AWS_REGION"
echo "stack:  $STACK_NAME"

if ! aws cloudformation deploy \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$ROOT_DIR/infra/graphflow-foundation.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName=graphflow \
    RunsTableName=GraphFlowRuns \
    EventBusName=graphflow-events; then
  echo
  echo "CloudFormation deployment failed. Recent stack events:"
  aws cloudformation describe-stack-events \
    --region "$AWS_REGION" \
    --stack-name "$STACK_NAME" \
    --query "StackEvents[0:10].{LogicalId:LogicalResourceId,Status:ResourceStatus,Reason:ResourceStatusReason}" \
    --output table
  exit 1
fi

echo
aws cloudformation describe-stacks \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs" \
  --output table
