#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_REGION="${AWS_REGION:-us-east-1}"
AURORA_STACK_NAME="${AURORA_STACK_NAME:-graphflow-aurora}"
MIN_ACU="${MIN_ACU:-1}"
MAX_ACU="${MAX_ACU:-2}"

echo "Deploying optional GraphFlow Aurora stack"
echo "region: $AWS_REGION"
echo "stack:  $AURORA_STACK_NAME"
echo "ACUs:   $MIN_ACU - $MAX_ACU"

if ! aws cloudformation deploy \
  --region "$AWS_REGION" \
  --stack-name "$AURORA_STACK_NAME" \
  --template-file "$ROOT_DIR/infra/graphflow-aurora.yaml" \
  --parameter-overrides \
    ProjectName=graphflow \
    DatabaseName=graphflow \
    MinCapacity="$MIN_ACU" \
    MaxCapacity="$MAX_ACU"; then
  echo
  echo "Aurora CloudFormation deployment failed. Recent stack events:"
  aws cloudformation describe-stack-events \
    --region "$AWS_REGION" \
    --stack-name "$AURORA_STACK_NAME" \
    --query "StackEvents[0:10].{LogicalId:LogicalResourceId,Status:ResourceStatus,Reason:ResourceStatusReason}" \
    --output table
  exit 1
fi

aws cloudformation describe-stacks \
  --region "$AWS_REGION" \
  --stack-name "$AURORA_STACK_NAME" \
  --query "Stacks[0].Outputs" \
  --output table
