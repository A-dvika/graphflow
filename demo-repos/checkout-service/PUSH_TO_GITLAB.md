# Push This Demo As A Separate GitLab Repo

Create an empty GitLab project for the checkout service, then run these commands from this folder:

```bash
git init
git add .
git commit -m "Add checkout service GraphFlow demo"
git branch -M main
git remote add origin git@gitlab.com:<namespace>/<checkout-service-repo>.git
git push -u origin main
```

In the GitLab project, add CI/CD variables:

```text
GRAPHFLOW_URL=https://your-graphflow-deployment.example
GRAPHFLOW_INGEST_TOKEN=<masked GraphFlow ingest token>
```

For the failure demo, run a pipeline with:

```text
DEMO_SECURITY_FAILURE=true
```

The `graphflow_register` job prints the exact GraphFlow dashboard URL for that pipeline run.
