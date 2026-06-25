import { z } from "zod";
import { type Status } from "@/lib/graphflow";

export const defaultTenantId = "demo";
export const defaultProjectId = "graphflow";
export const defaultWorkflowId = "release-command-center";
export const defaultRunId = "run_demo_001";

export const statusSchema = z.enum(["pending", "running", "success", "failed", "blocked", "waiting"]);

export const runActionSchema = z.enum(["reset", "start", "fail-security", "approve"]);

export const gitLabIngestSchema = z.object({
  tenantId: z.string().min(1).max(80).optional(),
  projectId: z.string().min(1).max(120).optional(),
  projectPath: z.string().min(1).max(240).optional(),
  pipelineId: z.string().min(1).max(120).optional(),
  runId: z.string().min(1).max(160).optional(),
  workflowId: z.string().min(1).max(120).optional(),
  nodeId: z.string().min(1).max(120).optional(),
  status: statusSchema.optional(),
  message: z.string().max(500).optional(),
  commitSha: z.string().max(80).optional(),
  branch: z.string().max(160).optional(),
  actor: z.string().max(160).optional(),
});

export type RunAction = z.infer<typeof runActionSchema>;
export type GitLabIngestPayload = z.infer<typeof gitLabIngestSchema>;

export type RunIdentity = {
  tenantId: string;
  projectId: string;
  workflowId: string;
  runId: string;
};

export function normalizeProjectId(projectId?: string, projectPath?: string) {
  const raw = projectId ?? projectPath ?? defaultProjectId;

  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/[/_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || defaultProjectId;
}

export function buildRunIdentity(input: Partial<RunIdentity> & { projectPath?: string; pipelineId?: string }) {
  const tenantId = input.tenantId ?? defaultTenantId;
  const projectId = normalizeProjectId(input.projectId, input.projectPath);
  const workflowId = input.workflowId ?? defaultWorkflowId;
  const runId = input.runId ?? (input.pipelineId ? `gitlab_${input.pipelineId}` : defaultRunId);

  return {
    tenantId,
    projectId,
    workflowId,
    runId,
  };
}

export function runPartitionKey(identity: RunIdentity) {
  return `TENANT#${identity.tenantId}#PROJECT#${identity.projectId}#RUN#${identity.runId}`;
}

export function legacyRunPartitionKey(runId: string) {
  return runId;
}

export function projectRunsPartitionKey(identity: Pick<RunIdentity, "tenantId" | "projectId">) {
  return `TENANT#${identity.tenantId}#PROJECT#${identity.projectId}`;
}

export function projectRunSortKey(updatedAt: string, runId: string) {
  return `RUN#${updatedAt}#${runId}`;
}

export function normalizeStatus(value: string | undefined): Status {
  const parsed = statusSchema.safeParse(value);

  return parsed.success ? parsed.data : "pending";
}

export function ttlFromNow(days: number) {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}
