# GraphFlow Product And UI Vision

## Product Summary

GraphFlow is a graph-based release quality gate for DevOps and platform engineering teams.

It does not replace GitLab, GitHub Actions, Jenkins, or existing CI/CD systems. Instead, it sits on
top of them as an intelligence and governance layer. Existing pipelines continue to run jobs,
tests, deployments, and approvals. GraphFlow ingests those pipeline events, maps them onto a
workflow graph, evaluates release risk, and tells teams whether production deployment should
continue.

Simple positioning:

```text
SonarQube checks code quality.
Snyk checks dependency/security risk.
GraphFlow checks release-flow risk.
```

The core question GraphFlow answers is:

```text
Is this release safe to continue?
```

## Why This Matters

Modern release pipelines are often visible but not deeply understood as systems.

A CI/CD tool can show that a job failed. GraphFlow explains what that failure means for the whole
release:

- Which downstream steps are blocked?
- Which production deploy path is now unsafe?
- Which approval or check is on the critical path?
- What can continue safely?
- What should be fixed first?
- Why did the gate block production?

For small teams with simple pipelines, the native CI/CD UI may be enough. GraphFlow becomes useful
when releases span multiple services, approvals, environments, database migrations, security checks,
and platform policies.

## Target Companies

GraphFlow is most useful for:

- Fintech and banking platforms with compliance-heavy releases.
- E-commerce and marketplace systems with payments, inventory, checkout, and fulfillment services.
- Healthcare and insurance software where release evidence matters.
- B2B SaaS platforms with many microservices and shared platform teams.
- Enterprise engineering teams that need standard release governance across many repositories.
- Platform engineering teams responsible for safe delivery across many product squads.

GraphFlow is less useful for:

- One-repo websites.
- Small products with a short pipeline and no production approval process.
- Teams that do not need release evidence, auditability, or cross-service visibility.

## System Shape

GraphFlow is intentionally split into deterministic infrastructure and optional agentic assistance.

Deterministic core:

- Aurora PostgreSQL stores workflow graph definitions: nodes, edges, dependencies, release topology.
- DynamoDB stores live run state, pipeline events, blocked nodes, and release history.
- EventBridge routes release events.
- Lambda provides the execution-worker foundation.
- Next.js API routes expose onboarding, ingest, gate, and agent endpoints.
- GitLab CI/CD calls GraphFlow as a reporting and required release-gate layer.

Optional agent layer:

- A Gemma-compatible model can explain gate decisions and recommend next actions.
- The model never becomes the source of truth for pass/fail.
- If the model is unavailable, the deterministic gate still works.
- The provider interface can start with free/self-hosted inference and later move to paid managed
  inference.

## Current Product Capabilities

Current MVP capabilities:

- Register workflow graph configs for project onboarding.
- Read workflow graphs from Aurora through RDS Data API.
- Store run state in DynamoDB.
- Ingest GitLab CI node status.
- Automatically mark downstream nodes as blocked when an upstream node fails.
- Calculate critical path and bottlenecks.
- Evaluate release gate decisions with `PASS`, `WARN`, or `FAIL`.
- Return HTTP `409` when GitLab should block the release.
- Generate optional release insight through an LLM provider.
- Fall back to deterministic insight when no model is configured.

## Creative Product Angle

The creative idea is not "another dashboard." The creative idea is that release pipelines become a
living graph that can be reasoned over.

Most CI/CD interfaces are timelines, tables, or job lists. GraphFlow should feel like a release
control room:

- The release is shown as a dependency graph.
- Failed nodes visually radiate downstream impact.
- The critical path is highlighted like a production route.
- Approvals appear as gates, not just jobs.
- Risk is explained as a decision, not just a red status.
- The agent acts like a release engineer sitting beside the dashboard.

The UI should make the graph feel operational, not decorative. The user should immediately see:

```text
What is blocked?
Why is it blocked?
What is the safest next move?
Can production continue?
```

## Enterprise-Buyable UI Features

### 1. Release Command Center

Primary screen for a live release.

Features:

- Graph canvas with nodes for build, tests, security, approvals, migration, staging, canary, and
  production.
- Color-coded node states: pending, running, success, failed, blocked, waiting.
- Critical path highlight.
- Blocked downstream paths highlighted from the failed node.
- Production gate status: `PASS`, `WARN`, or `FAIL`.
- Time impact estimate and bottleneck node.
- One-click copy of the release decision summary for Slack, incident notes, or change-management
  tickets.

Enterprise value:

- Teams can understand release state without reading CI YAML.
- Non-authors of the pipeline can safely participate in release decisions.

### 2. Release Gate Panel

Right-side decision panel that behaves like a quality gate.

Features:

- Current verdict: `PASS`, `WARN`, `FAIL`.
- Required checks list.
- Failed/blocked/waiting nodes.
- Blast radius list.
- Policy that triggered the verdict.
- "Why this gate failed" explanation.
- HTTP result preview for CI: `200` or `409`.

Enterprise value:

- Turns release knowledge into an enforceable standard.
- Helps platform teams define consistent release rules across projects.

### 3. Agent Insight Panel

Agentic explanation layer powered by a Gemma-compatible provider.

Features:

- Plain-language risk summary.
- Ranked next actions.
- "What can continue safely?" section.
- "What must stop?" section.
- Suggested owner or team based on node metadata in future versions.
- Deterministic fallback message when LLM is disabled.

Enterprise value:

- Reduces release triage time.
- Helps on-call engineers and release managers understand unfamiliar pipelines.

### 4. Onboarding Wizard For GitLab Projects

A setup flow for teams adding GraphFlow to their existing pipelines.

Features:

- Paste or upload `.gitlab-ci.yml`.
- Detect stages and jobs.
- Suggest graph nodes and edges.
- Generate `graphflow.config.json`.
- Generate GitLab jobs for register, report, and release gate.
- Show copy-paste CI snippets.
- Validate that required variables are present.

Enterprise value:

- Lowers adoption friction.
- Makes GraphFlow feel like a platform tool, not a science project.

### 5. Policy Builder

A no-code or low-code screen for release safety rules.

Features:

- Required node types: quality, security, approval, deploy.
- Environment-specific rules: staging vs production.
- Fail rules: fail on security, fail on blocked migration, warn on waiting approval.
- Change-window rules.
- Manual approval requirements.
- Policy preview against the current release graph.

Enterprise value:

- Lets platform teams define governance without editing every repo.
- Makes release rules visible and reviewable.

### 6. Multi-Project Portfolio View

Enterprise overview for platform teams.

Features:

- List of active releases across projects.
- Gate status per project.
- High-risk releases sorted to top.
- Common bottlenecks across teams.
- Mean blocked time and recent failure reasons.
- Filters by team, service, environment, branch, and verdict.

Enterprise value:

- Platform teams can manage release health across the organization.
- Leadership can see release risk without entering each CI system.

### 7. Audit And Evidence Timeline

Historical record of decisions.

Features:

- Timeline of events ingested from GitLab.
- Gate decisions over time.
- Who approved what and when, if metadata is available.
- Why a release was blocked.
- Which graph policy fired.
- Exportable JSON/CSV summary.

Enterprise value:

- Useful for compliance, postmortems, change review, and release governance.

### 8. DORA-Style Delivery Metrics

Metrics screen derived from graph events.

Features:

- Blocked time by node type.
- Change failure indicators.
- Release recovery time after failed gate.
- Bottleneck frequency.
- Approval wait time.
- Critical-path duration trends.
- Deployment rework count.

Enterprise value:

- Connects release intelligence to engineering productivity.
- Gives platform teams measurable improvement targets.

### 9. Service Dependency Lens

Graph view grouped by service or ownership.

Features:

- Group nodes by service, team, or environment.
- Show cross-service release dependencies.
- Highlight contracts and integration tests.
- Identify which service boundary caused a block.

Enterprise value:

- Especially useful for microservice companies.
- Helps teams reason about release risk across ownership boundaries.

### 10. Enterprise Admin Surface

Administrative screens for real customers.

Features:

- Organization, tenant, and project settings.
- Token management for GitLab ingest.
- Webhook/API key rotation.
- Policy templates.
- Role-based access controls.
- Environment variable health checks.
- Data retention controls.

Enterprise value:

- Makes the product credible for real adoption.
- Supports security and governance expectations.

## Suggested UI Information Architecture

Recommended main navigation:

- Command Center
- Releases
- Projects
- Policies
- Insights
- Audit
- Settings

Recommended first viewport:

- Left: release graph canvas.
- Right: release gate decision and agent insight.
- Top: project, run, branch, commit, environment, verdict.
- Bottom: event timeline or selected-node details.

## Visual Design Direction

GraphFlow should feel like a serious control plane, not a marketing page.

Recommended visual language:

- Dense but readable operational dashboard.
- Strong contrast between healthy, waiting, failed, and blocked states.
- Thin graph edges with clear directionality.
- Critical path as a highlighted route.
- Failed node impact shown through downstream edge emphasis.
- Compact panels with enterprise-style information hierarchy.
- Minimal decorative elements.
- Clear typography and small status badges.

Avoid:

- Generic landing-page hero layouts.
- Overly playful colors.
- Decorative cards that do not carry operational meaning.
- AI chatbot UI as the main product.
- Making the LLM look like the decision-maker.

## Demo Storyline

The best hackathon demo flow:

1. Show a normal GitLab pipeline.
2. Explain that GitLab runs jobs, but GraphFlow evaluates release safety.
3. Show GraphFlow ingesting pipeline state.
4. Open the release graph.
5. Inject or show a security failure.
6. GraphFlow highlights downstream blocked nodes.
7. The gate returns `FAIL` and would block production in GitLab.
8. The agent explains why and suggests the next action.
9. Show Aurora storing the graph and DynamoDB storing live run state.

Core line:

```text
GitLab tells us what ran. GraphFlow tells us whether the release is safe.
```

## MVP Versus Enterprise Roadmap

MVP:

- Single graph template.
- GitLab event ingest.
- Aurora graph storage.
- DynamoDB run state.
- Gate API.
- Basic dashboard.
- Optional agent insight.

Near-term enterprise features:

- GitLab YAML parser/onboarding wizard.
- Multi-project release list.
- Policy builder.
- Audit timeline.
- Better RBAC/token management.
- Agent-generated release summaries.

Long-term enterprise features:

- Multi-CI support.
- Organization-wide policy templates.
- Historical risk analytics.
- Service ownership mapping.
- Incident-management integrations.
- Change-management exports.
- Self-hosted or managed LLM inference.

## What Makes It Buyable

GraphFlow becomes buyable when it is:

- Easy to integrate with existing GitLab pipelines.
- Deterministic where it matters.
- Clear about why it blocks a release.
- Auditable after the fact.
- Useful to platform teams across many repos.
- Not dependent on one LLM provider.
- Able to show measurable reduction in release risk and triage time.

The product should be sold as a release governance and intelligence layer:

```text
GraphFlow helps engineering organizations standardize release safety without replacing their CI/CD.
```
