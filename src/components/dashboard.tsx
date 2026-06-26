"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  CheckCircle2,
  CircleDashed,
  Database,
  FileCode2,
  GitBranch,
  GitCommit,
  Lock,
  Play,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { ReleaseFlowGraph } from "@/components/release-flow-graph";
import { type ConsoleSection } from "@/lib/console-sections";
import { type FlowEdge, type FlowNode, type Status } from "@/lib/graphflow";

type GateVerdict = "PASS" | "WARN" | "FAIL";

type GateDecision = {
  verdict: GateVerdict;
  shouldBlock: boolean;
  summary: string;
  reasons: string[];
  failedNodes: string[];
  blockedNodes: string[];
  waitingNodes: string[];
  blastRadius: string[];
  requiredNodes: string[];
  criticalPath: {
    path: string[];
    minutes: number;
  };
};

type AgentInsight = {
  mode: "llm" | "deterministic";
  headline: string;
  explanation: string;
  nextActions: string[];
  riskAreas: string[];
  model: {
    configured: boolean;
    provider: string;
    name: string | null;
    error?: {
      name: string;
      message: string;
    };
  };
};

type RunOverview = {
  tenantId: string;
  projectId: string;
  runId: string;
  workflowId: string;
  run: {
    statuses: Record<string, Status>;
    events: string[];
    source: "dynamodb" | "demo-fallback";
    analysis: {
      blockedCount: number;
      completedCount: number;
      bottleneck: string | null;
      recommendation: string;
    };
  };
  workflow: {
    id: string;
    name: string;
    description: string;
    source: string;
  };
  graph: {
    nodes: FlowNode[];
    edges: FlowEdge[];
  };
  gate: GateDecision;
  insight: AgentInsight;
  sources: {
    run: string;
    workflow: string;
  };
};

type RunSummary = {
  runId: string;
  workflowId: string;
  status: string;
  message: string;
  updatedAt: string;
};

type ProjectRunsResponse = {
  runs: RunSummary[];
};

type SystemHealth = {
  ok: boolean;
  aws: {
    configured: boolean;
    regionConfigured: boolean;
  };
  aurora: {
    dataApiConfigured: boolean;
    directPostgresConfigured: boolean;
    probe: {
      configured: boolean;
      ok: boolean;
      workflowRows: number;
      error?: {
        name: string;
        message?: string;
      };
    };
  };
  workflow: {
    source: string;
    nodeCount: number;
    edgeCount: number;
  };
};

type DashboardProps = {
  section: ConsoleSection;
};

const demoRunId = "run_demo_001";
const defaultTarget = {
  tenantId: "demo",
  projectId: "graphflow",
  workflowId: "release-command-center",
  runId: demoRunId,
};

const emptyOverview: RunOverview = {
  tenantId: "demo",
  projectId: "graphflow",
  runId: demoRunId,
  workflowId: "release-command-center",
  run: {
    statuses: {},
    events: ["Loading release intelligence from GraphFlow backend."],
    source: "demo-fallback",
    analysis: {
      blockedCount: 0,
      completedCount: 0,
      bottleneck: null,
      recommendation: "Loading release analysis.",
    },
  },
  workflow: {
    id: "release-command-center",
    name: "Production Release",
    description: "Loading workflow graph.",
    source: "loading",
  },
  graph: {
    nodes: [],
    edges: [],
  },
  gate: {
    verdict: "WARN",
    shouldBlock: false,
    summary: "Loading release gate.",
    reasons: ["Waiting for backend response."],
    failedNodes: [],
    blockedNodes: [],
    waitingNodes: [],
    blastRadius: [],
    requiredNodes: [],
    criticalPath: {
      path: [],
      minutes: 0,
    },
  },
  insight: {
    mode: "deterministic",
    headline: "GraphFlow is loading release insight.",
    explanation: "The dashboard will show the graph gate and release agent once backend data is available.",
    nextActions: ["Load the current run."],
    riskAreas: [],
    model: {
      configured: false,
      provider: "none",
      name: null,
    },
  },
  sources: {
    run: "loading",
    workflow: "loading",
  },
};

function verdictStyles(verdict: GateVerdict) {
  if (verdict === "PASS") {
    return {
      border: "border-[var(--status-success)]",
      bg: "bg-[var(--status-success)]/10",
      text: "text-[var(--status-success)]",
    };
  }

  if (verdict === "FAIL") {
    return {
      border: "border-[var(--status-error)]",
      bg: "bg-[var(--status-error)]/10",
      text: "text-[var(--status-error)]",
    };
  }

  return {
    border: "border-[var(--status-warning)]",
    bg: "bg-[var(--status-warning)]/10",
    text: "text-[var(--status-warning)]",
  };
}

function statusLabel(status: Status | string) {
  return status.replace("-", " ").toUpperCase();
}

function statusTone(status: Status | string) {
  if (status === "success" || status === "ready" || status === "PASS") return "text-[var(--status-success)]";
  if (status === "failed" || status === "FAIL" || status === "blocked") return "text-[var(--status-error)]";
  if (status === "waiting" || status === "WARN") return "text-[var(--status-warning)]";
  if (status === "running") return "text-[var(--status-pending)]";
  return "text-[var(--foreground-secondary)]";
}

function runHealth(statuses: Record<string, Status>) {
  const values = Object.values(statuses);

  if (values.includes("failed") || values.includes("blocked")) return "blocked";
  if (values.length > 0 && values.every((status) => status === "success")) return "ready";
  if (values.includes("waiting")) return "waiting";
  return "running";
}

function formatSource(source: string) {
  return source.replace(/-/g, " ");
}

function nodeTypeLabel(type: FlowNode["type"]) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--foreground-secondary)]">{label}</p>
          <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
          <p className="mt-1 text-xs text-[var(--foreground-secondary)]">{detail}</p>
        </div>
        <Icon className={`h-6 w-6 ${tone}`} />
      </div>
    </div>
  );
}

function statusBadge(status: Status | string) {
  return (
    <span className={`rounded border border-[var(--border)] px-2 py-1 text-xs font-semibold ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

export function Dashboard({ section }: DashboardProps) {
  const [target, setTarget] = useState(defaultTarget);
  const [overview, setOverview] = useState<RunOverview>(emptyOverview);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConsole = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({
        tenantId: target.tenantId,
        projectId: target.projectId,
        workflowId: target.workflowId,
      });
      const [overviewResponse, runsResponse, healthResponse] = await Promise.all([
        fetch(`/api/runs/${target.runId}/overview?${query.toString()}`, { cache: "no-store" }),
        fetch(`/api/projects/${encodeURIComponent(target.projectId)}/runs?tenantId=${encodeURIComponent(target.tenantId)}&limit=10`, {
          cache: "no-store",
        }),
        fetch("/api/system/health", { cache: "no-store" }),
      ]);

      if (!overviewResponse.ok) {
        throw new Error(`Overview request failed with ${overviewResponse.status}.`);
      }

      const nextOverview = (await overviewResponse.json()) as RunOverview;
      const nextRuns = runsResponse.ok ? ((await runsResponse.json()) as ProjectRunsResponse).runs : [];
      const nextHealth = healthResponse.ok ? ((await healthResponse.json()) as SystemHealth) : null;

      setOverview(nextOverview);
      setRuns(nextRuns);
      setHealth(nextHealth);
      setSelectedNodeId(
        (current) =>
          current ??
          nextOverview.gate.failedNodes[0] ??
          nextOverview.gate.waitingNodes[0] ??
          nextOverview.graph.nodes[0]?.id ??
          null,
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "GraphFlow could not load backend state.");
    } finally {
      setIsLoading(false);
    }
  }, [target]);

  useEffect(() => {
    void Promise.resolve().then(loadConsole);
  }, [loadConsole]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const nextTarget = {
        tenantId: params.get("tenantId") || defaultTarget.tenantId,
        projectId: params.get("projectId") || defaultTarget.projectId,
        workflowId: params.get("workflowId") || defaultTarget.workflowId,
        runId: params.get("runId") || defaultTarget.runId,
      };

      setTarget((current) =>
        current.tenantId === nextTarget.tenantId &&
        current.projectId === nextTarget.projectId &&
        current.workflowId === nextTarget.workflowId &&
        current.runId === nextTarget.runId
          ? current
          : nextTarget,
      );
    });
  }, []);

  async function runAction(action: "reset" | "start" | "fail-security" | "approve") {
    setActiveAction(action);
    setError(null);

    try {
      const query = new URLSearchParams({
        tenantId: target.tenantId,
        projectId: target.projectId,
        workflowId: target.workflowId,
      });
      const response = await fetch(`/api/runs/${target.runId}/actions?${query.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Action failed with ${response.status}.`);
      }

      await loadConsole();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "GraphFlow action failed.");
    } finally {
      setActiveAction(null);
    }
  }

  const selectedNode = useMemo(
    () => overview.graph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [overview.graph.nodes, selectedNodeId],
  );

  const completedCount = overview.graph.nodes.filter((node) => overview.run.statuses[node.id] === "success").length;
  const failedCount = overview.graph.nodes.filter((node) => overview.run.statuses[node.id] === "failed").length;
  const blockedCount = overview.graph.nodes.filter((node) => overview.run.statuses[node.id] === "blocked").length;
  const waitingCount = overview.graph.nodes.filter((node) => overview.run.statuses[node.id] === "waiting").length;
  const runningCount = overview.graph.nodes.filter((node) => overview.run.statuses[node.id] === "running").length;
  const runStatus = runHealth(overview.run.statuses);
  const progress = overview.graph.nodes.length > 0 ? Math.round((completedCount / overview.graph.nodes.length) * 100) : 0;
  const verdictStyle = verdictStyles(overview.gate.verdict);
  const deploymentNodes = overview.graph.nodes.filter((node) => node.type === "deploy");
  const gateNodes = overview.graph.nodes.filter((node) => overview.gate.requiredNodes.includes(node.id));
  const successRate = overview.graph.nodes.length > 0 ? Math.round((completedCount / overview.graph.nodes.length) * 100) : 0;

  const stats = [
    {
      icon: Activity,
      label: "Run Health",
      value: statusLabel(runStatus),
      detail: `${completedCount}/${overview.graph.nodes.length} nodes complete`,
      tone: statusTone(runStatus),
    },
    {
      icon: Lock,
      label: "Gate Verdict",
      value: overview.gate.verdict,
      detail: overview.gate.shouldBlock ? "Would block production" : "Can continue",
      tone: verdictStyle.text,
    },
    {
      icon: GitBranch,
      label: "Critical Path",
      value: `${overview.gate.criticalPath.minutes}m`,
      detail: `${overview.gate.criticalPath.path.length} graph nodes`,
      tone: "text-[var(--status-pending)]",
    },
    {
      icon: AlertCircle,
      label: "Blast Radius",
      value: String(overview.gate.blastRadius.length),
      detail: `${blockedCount} blocked, ${failedCount} failed, ${waitingCount} waiting`,
      tone: overview.gate.blastRadius.length > 0 ? "text-[var(--status-warning)]" : "text-[var(--status-success)]",
    },
  ];

  const actionBar = (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => runAction("start")}
        disabled={Boolean(activeAction)}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--status-pending)] px-3 py-2 text-sm font-semibold text-[var(--background)] transition hover:opacity-90 disabled:opacity-50"
      >
        <Play className="h-4 w-4" />
        {activeAction === "start" ? "Starting" : "Start"}
      </button>
      <button
        onClick={() => runAction("fail-security")}
        disabled={Boolean(activeAction)}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--status-error)] px-3 py-2 text-sm font-semibold text-[var(--status-error)] transition hover:bg-[var(--status-error)]/10 disabled:opacity-50"
      >
        <AlertCircle className="h-4 w-4" />
        {activeAction === "fail-security" ? "Injecting" : "Inject Failure"}
      </button>
      <button
        onClick={() => runAction("approve")}
        disabled={Boolean(activeAction)}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--status-success)] px-3 py-2 text-sm font-semibold text-[var(--status-success)] transition hover:bg-[var(--status-success)]/10 disabled:opacity-50"
      >
        <CheckCircle2 className="h-4 w-4" />
        {activeAction === "approve" ? "Approving" : "Approve"}
      </button>
      <button
        onClick={() => runAction("reset")}
        disabled={Boolean(activeAction)}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] disabled:opacity-50"
      >
        <RotateCcw className="h-4 w-4" />
        {activeAction === "reset" ? "Resetting" : "Reset"}
      </button>
      <button
        onClick={() => loadConsole()}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        Refresh
      </button>
    </div>
  );

  function renderOverview() {
    return (
      <div className="space-y-6">
        <section className={`rounded-lg border p-4 ${verdictStyle.border} ${verdictStyle.bg}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className={`mt-0.5 h-5 w-5 ${verdictStyle.text}`} />
              <div>
                <p className={`text-sm font-semibold uppercase ${verdictStyle.text}`}>
                  GraphFlow Release Gate: {overview.gate.verdict}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">{overview.gate.summary}</h2>
                <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
                  {overview.gate.reasons[0] ?? "No active risk detected."}
                </p>
              </div>
            </div>
            {actionBar}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>{metricCard(stat)}</div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-[var(--foreground-secondary)]">Release progress</span>
              <span className="font-semibold text-[var(--foreground)]">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--background)]">
              <div className="h-full rounded-full bg-[var(--status-pending)] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--foreground-secondary)]">Storage sources</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {formatSource(overview.sources.workflow)} / {formatSource(overview.sources.run)}
                </p>
              </div>
              <GitCommit className="h-5 w-5 text-[var(--status-pending)]" />
            </div>
          </div>
        </section>

        <ReleaseFlowGraph
          blastRadius={overview.gate.blastRadius}
          criticalPath={overview.gate.criticalPath.path}
          edges={overview.graph.edges}
          nodes={overview.graph.nodes}
          onSelectNode={setSelectedNodeId}
          selectedNodeId={selectedNodeId}
          statuses={overview.run.statuses}
        />

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          {renderAgentCard()}
          {renderSelectedNodeCard()}
        </section>
      </div>
    );
  }

  function renderReleases() {
    return (
      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Active Release</h2>
              <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                {overview.workflow.name} is backed by {formatSource(overview.sources.workflow)} and run state from {formatSource(overview.sources.run)}.
              </p>
            </div>
            {actionBar}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {metricCard({
              icon: CircleDashed,
              label: "Nodes Complete",
              value: `${completedCount}/${overview.graph.nodes.length}`,
              detail: `${runningCount} running, ${waitingCount} waiting`,
              tone: "text-[var(--status-pending)]",
            })}
            {metricCard({
              icon: ShieldAlert,
              label: "Production Gate",
              value: overview.gate.verdict,
              detail: overview.gate.summary,
              tone: verdictStyle.text,
            })}
            {metricCard({
              icon: AlertCircle,
              label: "Blocked Work",
              value: String(blockedCount + failedCount),
              detail: `${overview.gate.blastRadius.length} downstream nodes impacted`,
              tone: blockedCount + failedCount > 0 ? "text-[var(--status-error)]" : "text-[var(--status-success)]",
            })}
          </div>

          <div className="mt-5 space-y-3">
            {overview.graph.nodes.map((node) => {
              const status = overview.run.statuses[node.id] ?? "pending";
              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className="grid w-full gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-left transition hover:border-[var(--status-pending)] md:grid-cols-[1fr_130px_110px]"
                >
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{node.label}</p>
                    <p className="mt-1 text-xs text-[var(--foreground-secondary)]">{nodeTypeLabel(node.type)} node in {overview.workflow.id}</p>
                  </div>
                  <div className="text-sm text-[var(--foreground-secondary)]">{node.duration}m expected</div>
                  <div>{statusBadge(status)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Recent Runs</h2>
          <div className="mt-4 space-y-3">
            {runs.length > 0 ? (
              runs.map((run) => (
                <div key={run.runId} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs text-[var(--foreground)]">{run.runId}</p>
                    {statusBadge(run.status)}
                  </div>
                  <p className="mt-2 text-xs text-[var(--foreground-secondary)]">{run.message}</p>
                  <p className="mt-3 text-[10px] uppercase text-[var(--foreground-secondary)]">{formatDate(run.updatedAt)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--foreground-secondary)]">No recent runs found yet.</p>
            )}
          </div>
        </aside>
      </section>
    );
  }

  function renderDeployments() {
    return (
      <div className="space-y-4">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Environment Path</h2>
              <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                GraphFlow treats staging, smoke, and production as dependency nodes so unsafe deploy paths can be blocked before prod.
              </p>
            </div>
            {actionBar}
          </div>
        </section>

        <ReleaseFlowGraph
          blastRadius={overview.gate.blastRadius}
          criticalPath={overview.gate.criticalPath.path}
          edges={overview.graph.edges}
          nodes={overview.graph.nodes}
          onSelectNode={setSelectedNodeId}
          selectedNodeId={selectedNodeId}
          statuses={overview.run.statuses}
        />

        <section className="grid gap-4 md:grid-cols-3">
          {deploymentNodes.map((node) => {
            const status = overview.run.statuses[node.id] ?? "pending";
            return (
              <div key={node.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--foreground-secondary)]">{nodeTypeLabel(node.type)}</p>
                    <h3 className="mt-1 font-semibold text-[var(--foreground)]">{node.label}</h3>
                  </div>
                  <Server className={`h-5 w-5 ${statusTone(status)}`} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  {statusBadge(status)}
                  <span className="text-xs text-[var(--foreground-secondary)]">{node.duration}m</span>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  function renderQualityGates() {
    return (
      <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className={`rounded-lg border p-5 ${verdictStyle.border} ${verdictStyle.bg}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-sm font-semibold uppercase ${verdictStyle.text}`}>Current verdict</p>
              <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">{overview.gate.verdict}</h2>
              <p className="mt-2 text-sm text-[var(--foreground-secondary)]">{overview.gate.summary}</p>
            </div>
            <ShieldAlert className={`h-8 w-8 ${verdictStyle.text}`} />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {gateNodes.map((node) => {
              const status = overview.run.statuses[node.id] ?? "pending";
              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-left transition hover:border-[var(--status-pending)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">{node.label}</p>
                      <p className="mt-1 text-xs text-[var(--foreground-secondary)]">{nodeTypeLabel(node.type)}</p>
                    </div>
                    {statusBadge(status)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Decision Evidence</h2>
          <div className="mt-4 space-y-3">
            {overview.gate.reasons.map((reason) => (
              <div key={reason} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground-secondary)]">
                {reason}
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm">
            <div className="flex justify-between border-b border-[var(--border)] pb-2">
              <span className="text-[var(--foreground-secondary)]">CI response</span>
              <span className={overview.gate.shouldBlock ? "text-[var(--status-error)]" : "text-[var(--status-success)]"}>
                {overview.gate.shouldBlock ? "409 block" : "200 pass"}
              </span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-[var(--foreground-secondary)]">Required nodes</span>
              <span className="text-[var(--foreground)]">{overview.gate.requiredNodes.length}</span>
            </div>
          </div>
        </aside>
      </section>
    );
  }

  function renderAnalytics() {
    const bars = [
      { label: "Completed", value: completedCount, tone: "bg-[var(--status-success)]" },
      { label: "Running", value: runningCount, tone: "bg-[var(--status-pending)]" },
      { label: "Waiting", value: waitingCount, tone: "bg-[var(--status-warning)]" },
      { label: "Blocked", value: blockedCount + failedCount, tone: "bg-[var(--status-error)]" },
    ];

    return (
      <div className="space-y-4">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCard({
            icon: BarChart3,
            label: "Node Success",
            value: `${successRate}%`,
            detail: `${completedCount} successful graph nodes`,
            tone: successRate === 100 ? "text-[var(--status-success)]" : "text-[var(--status-pending)]",
          })}
          {metricCard({
            icon: GitBranch,
            label: "Critical Path",
            value: `${overview.gate.criticalPath.minutes}m`,
            detail: overview.gate.criticalPath.path.join(" -> ") || "No path calculated",
            tone: "text-[var(--status-pending)]",
          })}
          {metricCard({
            icon: AlertCircle,
            label: "Bottleneck",
            value: overview.run.analysis.bottleneck ?? "none",
            detail: overview.run.analysis.recommendation,
            tone: overview.run.analysis.bottleneck ? "text-[var(--status-warning)]" : "text-[var(--status-success)]",
          })}
          {metricCard({
            icon: Activity,
            label: "Recent Runs",
            value: String(runs.length),
            detail: "Stored in DynamoDB run history",
            tone: "text-[var(--foreground)]",
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Flow Distribution</h2>
            <div className="mt-5 space-y-4">
              {bars.map((bar) => {
                const width = overview.graph.nodes.length > 0 ? Math.round((bar.value / overview.graph.nodes.length) * 100) : 0;
                return (
                  <div key={bar.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-[var(--foreground-secondary)]">{bar.label}</span>
                      <span className="font-semibold text-[var(--foreground)]">{bar.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--background)]">
                      <div className={`h-full rounded-full ${bar.tone}`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Risk Areas</h2>
            <div className="mt-4 space-y-3">
              {(overview.insight.riskAreas.length > 0 ? overview.insight.riskAreas : overview.gate.reasons).map((item) => (
                <div key={item} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground-secondary)]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  function renderLogs() {
    return (
      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Run Event Timeline</h2>
          <div className="mt-5 space-y-3">
            {overview.run.events.map((event, index) => (
              <div key={`${event}-${index}`} className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--status-pending)]/15 text-xs font-semibold text-[var(--status-pending)]">
                  {index + 1}
                </span>
                <p className="text-sm text-[var(--foreground-secondary)]">{event}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Backend Sources</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between border-b border-[var(--border)] pb-2">
              <dt className="text-[var(--foreground-secondary)]">Graph</dt>
              <dd className="text-[var(--foreground)]">{formatSource(overview.sources.workflow)}</dd>
            </div>
            <div className="flex justify-between border-b border-[var(--border)] pb-2">
              <dt className="text-[var(--foreground-secondary)]">Run state</dt>
              <dd className="text-[var(--foreground)]">{formatSource(overview.sources.run)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--foreground-secondary)]">Events</dt>
              <dd className="text-[var(--foreground)]">{overview.run.events.length}</dd>
            </div>
          </dl>
        </aside>
      </section>
    );
  }

  function renderSettings() {
    const checks = [
      {
        label: "AWS credentials",
        ok: Boolean(health?.aws.configured),
        detail: health?.aws.regionConfigured ? "Region configured" : "Region missing",
      },
      {
        label: "Aurora Data API",
        ok: Boolean(health?.aurora.dataApiConfigured && health.aurora.probe.ok),
        detail: `${health?.aurora.probe.workflowRows ?? 0} workflow rows visible`,
      },
      {
        label: "Workflow graph",
        ok: overview.sources.workflow !== "demo-fallback",
        detail: `${overview.graph.nodes.length} nodes, ${overview.graph.edges.length} edges`,
      },
      {
        label: "Agent runtime",
        ok: overview.insight.model.configured,
        detail: `${overview.insight.mode} / ${overview.insight.model.provider}`,
      },
    ];

    return (
      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Backend Health</h2>
              <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                This view confirms the services needed by the release console without exposing secrets.
              </p>
            </div>
            <button
              onClick={() => loadConsole()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--background)] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {checks.map((check) => (
              <div key={check.label} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{check.label}</p>
                    <p className="mt-1 text-xs text-[var(--foreground-secondary)]">{check.detail}</p>
                  </div>
                  {check.ok ? (
                    <CheckCircle2 className="h-5 w-5 text-[var(--status-success)]" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-[var(--status-warning)]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Runtime</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between border-b border-[var(--border)] pb-2">
              <dt className="text-[var(--foreground-secondary)]">System</dt>
              <dd className={health?.ok ? "text-[var(--status-success)]" : "text-[var(--status-warning)]"}>
                {health?.ok ? "healthy" : "degraded"}
              </dd>
            </div>
            <div className="flex justify-between border-b border-[var(--border)] pb-2">
              <dt className="text-[var(--foreground-secondary)]">Workflow source</dt>
              <dd className="text-[var(--foreground)]">{health?.workflow.source ?? overview.workflow.source}</dd>
            </div>
            <div className="flex justify-between border-b border-[var(--border)] pb-2">
              <dt className="text-[var(--foreground-secondary)]">Agent provider</dt>
              <dd className="text-[var(--foreground)]">{overview.insight.model.provider}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--foreground-secondary)]">Selected run</dt>
              <dd className="font-mono text-[var(--foreground)]">{overview.runId}</dd>
            </div>
          </dl>
        </aside>
      </section>
    );
  }

  function renderDocumentation() {
    const snippets = [
      {
        title: "Register a workflow graph",
        code: "POST /api/workflows/register",
        detail: "Stores graph nodes and edges in Aurora for a project release template.",
      },
      {
        title: "Report CI job state",
        code: "POST /api/ingest/gitlab",
        detail: "GitLab jobs publish node status transitions into GraphFlow run state.",
      },
      {
        title: "Enforce a release gate",
        code: "GET /api/runs/{runId}/gate",
        detail: "Returns PASS, WARN, or FAIL so CI can block unsafe production releases.",
      },
      {
        title: "Read the command center",
        code: "GET /api/runs/{runId}/overview",
        detail: "Combines Aurora graph, DynamoDB run state, gate evidence, and agent insight.",
      },
    ];

    return (
      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-[var(--status-pending)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Integration Surface</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {snippets.map((item) => (
              <div key={item.code} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
                <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                <code className="mt-3 block rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--status-pending)]">
                  {item.code}
                </code>
                <p className="mt-3 text-sm text-[var(--foreground-secondary)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">MVP Architecture</h2>
          <div className="mt-4 space-y-3">
            {[
              { icon: Database, label: "Aurora PostgreSQL", detail: "Graph definitions and release topology" },
              { icon: Database, label: "DynamoDB", detail: "Live run state and event timeline" },
              { icon: RadioTower, label: "EventBridge", detail: "Event-driven orchestration foundation" },
              { icon: Bot, label: "Agent layer", detail: "Optional Gemma-compatible explanation provider" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                  <Icon className="mt-0.5 h-4 w-4 text-[var(--status-pending)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.label}</p>
                    <p className="mt-1 text-xs text-[var(--foreground-secondary)]">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </section>
    );
  }

  function renderAgentCard() {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[var(--status-pending)]" />
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Release Risk Agent</h3>
        </div>
        <p className="mt-3 text-xl font-semibold text-[var(--foreground)]">{overview.insight.headline}</p>
        <p className="mt-3 text-sm leading-6 text-[var(--foreground-secondary)]">{overview.insight.explanation}</p>
        <div className="mt-5">
          <p className="text-sm font-semibold text-[var(--foreground)]">Recommended next actions</p>
          <ol className="mt-3 space-y-2">
            {overview.insight.nextActions.map((action, index) => (
              <li key={action} className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground-secondary)]">
                <span className="font-semibold text-[var(--status-pending)]">{index + 1}</span>
                <span>{action}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  function renderSelectedNodeCard() {
    return (
      <aside className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--status-pending)]" />
          <h3 className="font-semibold text-[var(--foreground)]">Selected Graph Node</h3>
        </div>
        {selectedNode ? (
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between border-b border-[var(--border)] pb-2">
              <dt className="text-[var(--foreground-secondary)]">Node</dt>
              <dd className="text-[var(--foreground)]">{selectedNode.label}</dd>
            </div>
            <div className="flex justify-between border-b border-[var(--border)] pb-2">
              <dt className="text-[var(--foreground-secondary)]">Status</dt>
              <dd className={statusTone(overview.run.statuses[selectedNode.id] ?? "pending")}>
                {statusLabel(overview.run.statuses[selectedNode.id] ?? "pending")}
              </dd>
            </div>
            <div className="flex justify-between border-b border-[var(--border)] pb-2">
              <dt className="text-[var(--foreground-secondary)]">Type</dt>
              <dd className="text-[var(--foreground)]">{nodeTypeLabel(selectedNode.type)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--foreground-secondary)]">Duration</dt>
              <dd className="text-[var(--foreground)]">{selectedNode.duration}m</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-[var(--foreground-secondary)]">Select any node from the graph or run list.</p>
        )}
      </aside>
    );
  }

  function renderSection() {
    if (section === "releases") return renderReleases();
    if (section === "deployments") return renderDeployments();
    if (section === "quality-gates") return renderQualityGates();
    if (section === "analytics") return renderAnalytics();
    if (section === "logs") return renderLogs();
    if (section === "settings") return renderSettings();
    if (section === "documentation") return renderDocumentation();
    return renderOverview();
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-[var(--status-error)] bg-[var(--status-error)]/10 p-4 text-sm text-[var(--status-error)]">
          {error}
        </div>
      )}

      {renderSection()}
    </div>
  );
}
