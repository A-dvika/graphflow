#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_REGION="${AWS_REGION:-us-east-1}"
AURORA_STACK_NAME="${AURORA_STACK_NAME:-graphflow-aurora}"
DATABASE_NAME="${DATABASE_NAME:-graphflow}"

output_value() {
  local key="$1"
  aws cloudformation describe-stacks \
    --region "$AWS_REGION" \
    --stack-name "$AURORA_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue | [0]" \
    --output text
}

CLUSTER_ARN="${AURORA_CLUSTER_ARN:-$(output_value ClusterArn)}"
SECRET_ARN="${AURORA_SECRET_ARN:-$(output_value SecretArn)}"
SQL="$(cat "$ROOT_DIR/database/aurora-bootstrap-data-api.sql")"

if [ -z "$CLUSTER_ARN" ] || [ "$CLUSTER_ARN" = "None" ]; then
  echo "Aurora cluster ARN not found."
  exit 1
fi

if [ -z "$SECRET_ARN" ] || [ "$SECRET_ARN" = "None" ]; then
  echo "Aurora secret ARN not found."
  exit 1
fi

aws rds-data execute-statement \
  --region "$AWS_REGION" \
  --resource-arn "$CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE_NAME" \
  --sql "$SQL" >/dev/null

echo "Aurora graph schema bootstrapped through Data API."
