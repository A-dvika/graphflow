# GraphFlow Enterprise Slice Status

This document tracks the enterprise features that strengthen the GraphFlow product story.

## Built And Demo-Ready

### Release Policy Engine

GraphFlow now has an org-level release policy model and API.

- Default production release safety policy.
- Required node types: quality, security, approval, deploy.
- Production-blocking node types: security, deploy.
- Waiting approval warning rule.
- Migration-risk blocking rule.
- Approval-before-deploy rule.
- Policy-aware release gate decisions.

API:

```text
GET /api/policies/{policyId}
PUT /api/policies/{policyId}
```

### Database Migration Risk Intelligence

GraphFlow now detects migration-related graph nodes and attaches migration risk to the gate decision.

Risk levels:

- `none`: no migration node found.
- `low`: migration evidence completed.
- `medium`: migration evidence is pending or waiting.
- `high`: migration-related node failed or is blocked.

This is visible in the dashboard and included in gate/compliance output.

### Approval Gate Evidence

Approval nodes are first-class graph nodes and part of the release policy.

The gate can now explain:

- approval waiting
- approval incomplete
- approval required before deploy evidence is accepted

Full RBAC/SSO/SAML is still roadmap, but the approval evidence model is now wired into the gate.

### Audit Persistence In Aurora

GraphFlow now writes release audit events to Aurora when Aurora is configured.

Persisted evidence includes:

- tenant
- project
- workflow
- run
- event type
- actor
- node
- status
- message
- metadata such as GitLab pipeline, branch, commit, and source

Schema objects:

```text
release_audit_events
release_audit_summary
```

### Compliance Evidence Export

GraphFlow now exposes a compliance-style release artifact.

API:

```text
GET /api/runs/{runId}/compliance
```

The export includes:

- workflow graph summary
- critical path
- release gate decision
- org policy evidence
- migration risk
- run state
- Aurora audit events
- SOC 2-style release approval/change-management evidence flags
- PCI-style security/deployment evidence flags

## Partially Built

### Multi-Repo Orchestration

The data model supports tenant/project/workflow/run identity, which is the base for multi-project releases.

Still needed:

- parent release grouping
- child project runs
- cross-repo dependency edges
- portfolio release view

### Rollback Groups

The graph model can represent rollback dependencies as nodes/edges, but rollback groups are not yet a first-class API.

Still needed:

- rollback group schema
- impacted-service grouping
- rollback evidence export

### Org-Level Metrics Dashboard

The dashboard shows run-level analytics and recent release history.

Still needed:

- organization-wide metrics aggregation
- historical pattern detection
- bottleneck trends across teams
- approval wait-time trends

## Roadmap

### RBAC / SSO / SAML

Not built yet.

Recommended next step:

- add role model: platform admin, release manager, engineer, auditor
- integrate with an auth provider
- require roles for policy writes and approvals

### Integration Marketplace

Not built yet.

Current demo integration:

- GitLab CI/CD

Recommended next integrations:

- GitHub Actions
- Jenkins
- CircleCI
- ArgoCD
- Datadog
- PagerDuty
- Slack

## Demo Positioning

The strongest story now is:

```text
GitLab runs the pipeline.
GraphFlow enforces org release policy, explains migration/security/approval risk,
persists audit evidence in Aurora, and exports compliance-ready release artifacts.
```
