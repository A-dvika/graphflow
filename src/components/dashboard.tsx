"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  GitBranch,
  GitCommit,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { ReleaseFlowGraph } from "@/components/release-flow-graph";
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

const demoRunId = "run_demo_001";

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
  if (status === "success") return "text-[var(--status-success)]";
  if (status === "failed") return "text-[var(--status-error)]";
  if (status === "blocked" || status === "waiting") return "text-[var(--status-warning)]";
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

export function Dashboard() {
  const [overview, setOverview] = useState<RunOverview>(emptyOverview);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [activeTab, setActiveTab] = useState("graph");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [overviewResponse, runsResponse] = await Promise.all([
        fetch(`/api/runs/${demoRunId}/overview`, { cache: "no-store" }),
        fetch("/api/projects/graphflow/runs?limit=5", { cache: "no-store" }),
      ]);

      if (!overviewResponse.ok) {
        throw new Error(`Overview request failed with ${overviewResponse.status}.`);
      }

      const nextOverview = (await overviewResponse.json()) as RunOverview;
      const nextRuns = runsResponse.ok ? ((await runsResponse.json()) as ProjectRunsResponse).runs : [];

      setOverview(nextOverview);
      setRuns(nextRuns);
      setSelectedNodeId((current) => current ?? nextOverview.gate.failedNodes[0] ?? nextOverview.gate.waitingNodes[0] ?? nextOverview.graph.nodes[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "GraphFlow could not load backend state.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadOverview);
  }, [loadOverview]);

  async function runAction(action: "reset" | "start" | "fail-security" | "approve") {
    setActiveAction(action);
    setError(null);

    try {
      const response = await fetch(`/api/runs/${demoRunId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Action failed with ${response.status}.`);
      }

      await loadOverview();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "GraphFlow action failed.");
    } finally {
      setActiveAction(null);
    }
  }

  const completedCount = overview.graph.nodes.filter((node) => overview.run.statuses[node.id] === "success").length;
  const failedCount = overview.graph.nodes.filter((node) => overview.run.statuses[node.id] === "failed").length;
  const blockedCount = overview.graph.nodes.filter((node) => overview.run.statuses[node.id] === "blocked").length;
  const waitingCount = overview.graph.nodes.filter((node) => overview.run.statuses[node.id] === "waiting").length;
  const runStatus = runHealth(overview.run.statuses);
  const progress = overview.graph.nodes.length > 0 ? Math.round((completedCount / overview.graph.nodes.length) * 100) : 0;
  const verdictStyle = verdictStyles(overview.gate.verdict);
  const selectedNode = useMemo(
    () => overview.graph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [overview.graph.nodes, selectedNodeId],
  );

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

  return (
    <div className="space-y-6">
      <section className={`rounded-lg border p-4 ${verdictStyle.border} ${verdictStyle.bg}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className={`mt-0.5 h-5 w-5 ${verdictStyle.text}`} />
            <div>
              <p className={`text-sm font-semibold uppercase tracking-wide ${verdictStyle.text}`}>
                GraphFlow Release Gate: {overview.gate.verdict}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">{overview.gate.summary}</h2>
              <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
                {overview.gate.reasons[0] ?? "No active risk detected."}
              </p>
            </div>
          </div>

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
              onClick={() => loadOverview()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface)] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-[var(--status-error)] bg-[var(--status-error)]/10 p-4 text-sm text-[var(--status-error)]">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--foreground-secondary)]">{stat.label}</p>
                  <p className={`mt-2 text-2xl font-bold ${stat.tone}`}>{stat.value}</p>
                  <p className="mt-1 text-xs text-[var(--foreground-secondary)]">{stat.detail}</p>
                </div>
                <Icon className={`h-6 w-6 ${stat.tone}`} />
              </div>
            </div>
          );
        })}
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

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)]">
          {[
            ["graph", "Release Graph"],
            ["gates", "Gate Evidence"],
            ["agent", "Agent Insight"],
            ["audit", "Audit Timeline"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === id
                  ? "border-[var(--status-pending)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "graph" && (
          <ReleaseFlowGraph
            blastRadius={overview.gate.blastRadius}
            criticalPath={overview.gate.criticalPath.path}
            edges={overview.graph.edges}
            nodes={overview.graph.nodes}
            onSelectNode={setSelectedNodeId}
            selectedNodeId={selectedNodeId}
            statuses={overview.run.statuses}
          />
        )}

        {activeTab === "gates" && (
          <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Required Release Gates</h3>
              <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                These checks come from the workflow graph and determine the production gate.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {overview.graph.nodes
                  .filter((node) => overview.gate.requiredNodes.includes(node.id))
                  .map((node) => {
                    const status = overview.run.statuses[node.id] ?? "pending";
                    return (
                      <button
                        key={node.id}
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          setActiveTab("graph");
                        }}
                        className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-left transition hover:border-[var(--status-pending)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">{node.label}</p>
                            <p className="mt-1 text-xs text-[var(--foreground-secondary)]">{node.type}</p>
                          </div>
                          <span className={`text-xs font-semibold ${statusTone(status)}`}>{statusLabel(status)}</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Decision Evidence</h3>
              <ul className="mt-4 space-y-3 text-sm">
                {overview.gate.reasons.map((reason) => (
                  <li key={reason} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-[var(--foreground-secondary)]">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {activeTab === "agent" && (
          <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
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

            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--status-pending)]" />
                <h3 className="font-semibold text-[var(--foreground)]">Agent Runtime</h3>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between border-b border-[var(--border)] pb-2">
                  <dt className="text-[var(--foreground-secondary)]">Mode</dt>
                  <dd className="text-[var(--foreground)]">{overview.insight.mode}</dd>
                </div>
                <div className="flex justify-between border-b border-[var(--border)] pb-2">
                  <dt className="text-[var(--foreground-secondary)]">Provider</dt>
                  <dd className="text-[var(--foreground)]">{overview.insight.model.provider}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--foreground-secondary)]">Configured</dt>
                  <dd className="text-[var(--foreground)]">{overview.insight.model.configured ? "yes" : "no"}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}

        {activeTab === "audit" && (
          <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Run Event Timeline</h3>
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

            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Recent Runs</h3>
              <div className="mt-4 space-y-3">
                {runs.length > 0 ? (
                  runs.map((run) => (
                    <div key={run.runId} className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-xs text-[var(--foreground)]">{run.runId}</p>
                        <span className={`text-xs font-semibold ${statusTone(run.status)}`}>{run.status}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-[var(--foreground-secondary)]">{run.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--foreground-secondary)]">No recent runs found yet.</p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {selectedNode && (
        <p className="text-xs text-[var(--foreground-secondary)]">
          Selected node: <span className="font-semibold text-[var(--foreground)]">{selectedNode.label}</span>
        </p>
      )}
    </div>
  );
}
