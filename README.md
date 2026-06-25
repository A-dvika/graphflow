# GraphFlow

GraphFlow is a graph-native release intelligence app for engineering teams. It models release
pipelines as dependency graphs so teams can see the critical path, blocked downstream steps, and
the bottleneck delaying production.

Built for **H0: Hack the Zero Stack with Vercel v0 and AWS Databases**.

## Demo

```bash
npm run dev
```

Open the local URL printed by Next.js in your terminal.

Demo flow:

1. Click **Start Release**.
2. Watch Build unlock Unit Tests and Security Scan.
3. Click **Inject Failure** to see downstream deploy steps blocked.
4. Reset, start again, and click **Approve** to complete production deploy.

## AWS Architecture

- Vercel / Next.js: frontend and API routes
- Aurora PostgreSQL: workflow graph storage
- DynamoDB: execution state and event log
- Lambda: node execution worker
- EventBridge: workflow event routing

See:

- `docs/aws-setup.md`
- `docs/architecture.md`
- `docs/gitlab-cicd.md`
- `database/aurora-schema.sql`

## API Routes

- `GET /api/workflows/release-template`
- `POST /api/runs/start`

These routes currently return demo data and storage contracts. They are the integration points for
Aurora PostgreSQL and DynamoDB.

## CLI Deployment

The repo includes Bash scripts for repeatable deployment. On Windows, run these from Git Bash or
WSL. This machine currently does not have a WSL Linux distribution installed.

Check local tools:

```bash
bash scripts/check-prereqs.sh
```

Deploy AWS foundation resources:

```bash
export AWS_REGION=us-east-1
bash scripts/deploy-aws-foundation.sh
```

This creates:

- DynamoDB table: `GraphFlowRuns`
- EventBridge bus: `graphflow-events`
- Lambda function: `graphflow-node-runner`

Seed a DynamoDB demo run for screenshots:

```bash
bash scripts/seed-demo-run.sh
```

Deploy the frontend to Vercel:

```bash
vercel login
bash scripts/deploy-vercel.sh
```
