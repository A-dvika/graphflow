# GraphFlow AWS Setup

Use `us-east-1` unless you already picked another region. Keep resources small for the hackathon.

## 1. Cost Controls

1. Open **Billing and Cost Management -> Budgets**.
2. Create a cost budget named `graphflow-hackathon-budget`.
3. Set the budget to `$80` so you get warned before the `$100` credit is exhausted.

## 2. IAM Permissions For CI

The GitLab pipeline needs permission to create the hackathon resources.

Attach the policy in `infra/graphflow-deployer-policy.json` to the IAM user used by GitLab CI.

AWS console path:

1. Open **IAM -> Users**.
2. Select the CI user.
3. Open **Permissions**.
4. Choose **Add permissions -> Create inline policy**.
5. Choose **JSON**.
6. Paste `infra/graphflow-deployer-policy.json`.
7. Save it as `GraphFlowDeployerPolicy`.

Do not paste access keys into docs, commits, screenshots, or chat.

## 3. CLI Foundation Deploy

Run this from Git Bash, WSL, macOS, or Linux after configuring AWS CLI credentials:

```bash
export AWS_REGION=us-east-1
bash scripts/check-prereqs.sh
bash scripts/deploy-aws-foundation.sh
bash scripts/seed-demo-run.sh
```

This creates:

- DynamoDB table: `GraphFlowRuns`
- EventBridge bus: `graphflow-events`
- Lambda function: `graphflow-node-runner`

## 4. Aurora PostgreSQL

Purpose: stores the workflow graph.

Recommended hackathon setup:

- Engine: Aurora PostgreSQL
- Template: Dev/Test
- Capacity: smallest available serverless/dev option
- Database name: `graphflow`
- Initial schema: run `database/aurora-schema.sql`

Tables:

- `workflows`
- `workflow_nodes`
- `workflow_edges`

Screenshot needed for submission:

- Aurora cluster/database visible in AWS Console
- Optional: query editor showing `select * from workflow_graph;`

## 5. DynamoDB

Purpose: stores execution state for release runs.

The CLI foundation deploy creates this table:

- Table name: `GraphFlowRuns`
- Partition key: `pk` string
- Sort key: `sk` string
- Capacity mode: on-demand
- Global secondary index: `gsi1`
- TTL attribute: `expiresAt`

Example items:

- `pk = run_123`, `sk = META`
- `pk = run_123`, `sk = NODE#build`
- `pk = run_123`, `sk = EVENT#2026-06-25T12:00:00Z`

Important attributes:

- `workflowId`
- `nodeId`
- `status`
- `startedAt`
- `finishedAt`
- `message`

Screenshot needed for submission:

- DynamoDB table list showing `GraphFlowRuns`
- Items tab showing at least one run item

## 6. EventBridge

Purpose: routes execution events between workflow nodes.

The CLI foundation deploy creates this event bus:

- Name: `graphflow-events`

Event detail types:

- `node.started`
- `node.succeeded`
- `node.failed`
- `approval.waiting`
- `approval.granted`

Screenshot needed:

- EventBridge custom bus or rule named with `graphflow`

## 7. Lambda

Purpose: simulates node execution.

The CLI foundation deploy creates this function:

- Name: `graphflow-node-runner`
- Runtime: Node.js 20.x or latest available Node.js runtime

Demo behavior:

- Accept `runId` and `nodeId`
- Write node status to DynamoDB
- Publish `node.succeeded` or `node.failed` to EventBridge

Screenshot needed:

- Lambda function page showing `graphflow-node-runner`

## 8. Vercel

Purpose: hosts the Next.js frontend.

Deploy with CLI:

```bash
vercel login
bash scripts/deploy-vercel.sh
```

Add these Vercel environment variables before relying on live backend reads:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_DEFAULT_REGION
GRAPHFLOW_RUNS_TABLE
GRAPHFLOW_EVENT_BUS
GRAPHFLOW_INGEST_TOKEN
GRAPHFLOW_RUN_RETENTION_DAYS
```

Submission needs:

- Published Vercel Project Link
- Vercel Team ID

## 9. Demo Script

1. Open GraphFlow dashboard.
2. Show graph and say Aurora stores nodes and edges.
3. Click **Start Release**.
4. Show event stream and say DynamoDB stores run state.
5. Click **Inject Failure**.
6. Show blocked downstream deploy nodes and bottleneck summary.
7. Click **Reset**, **Start Release**, then **Approve**.
8. Show successful production deploy.
9. Show architecture diagram and AWS screenshots.
