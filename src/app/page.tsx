"use client";

import { useMemo, useState } from "react";
import {
  findCriticalPath,
  initialStatuses,
  releaseEdges,
  releaseNodes,
  type Status,
} from "@/lib/graphflow";

const statusStyles: Record<Status, string> = {
  pending: "border-slate-300 bg-white text-slate-600",
  running: "border-sky-500 bg-sky-50 text-sky-900",
  success: "border-emerald-500 bg-emerald-50 text-emerald-900",
  failed: "border-rose-500 bg-rose-50 text-rose-900",
  blocked: "border-amber-500 bg-amber-50 text-amber-950",
  waiting: "border-violet-500 bg-violet-50 text-violet-950",
};

const statusLabels: Record<Status, string> = {
  pending: "Pending",
  running: "Running",
  success: "Succeeded",
  failed: "Failed",
  blocked: "Blocked",
  waiting: "Waiting",
};

type ReleaseRunResponse = {
  statuses: Record<string, Status>;
  events: string[];
  source: "dynamodb" | "demo-fallback";
};

const demoRunId = "run_demo_001";

export default function Home() {
  const [statuses, setStatuses] = useState<Record<string, Status>>(initialStatuses);
  const [eventLog, setEventLog] = useState<string[]>([
    "Release graph loaded from Aurora PostgreSQL template.",
  ]);
  const [backendSource, setBackendSource] = useState<ReleaseRunResponse["source"]>("demo-fallback");
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const criticalPath = useMemo(() => findCriticalPath(), []);
  const blockedCount = Object.values(statuses).filter((status) => status === "blocked").length;
  const completedCount = Object.values(statuses).filter((status) => status === "success").length;
  const waitingNode = releaseNodes.find((node) => statuses[node.id] === "waiting");
  const failedNode = releaseNodes.find((node) => statuses[node.id] === "failed");

  function applyRunResponse(run: ReleaseRunResponse) {
    setStatuses(run.statuses);
    setEventLog(run.events.length > 0 ? run.events : ["No backend events found for this run."]);
    setBackendSource(run.source);
  }

  async function loadBackendRun() {
    setIsLoadingBackend(true);
    try {
      const response = await fetch(`/api/runs/${demoRunId}`, { cache: "no-store" });
      const run = (await response.json()) as ReleaseRunResponse;
      applyRunResponse(run);
    } finally {
      setIsLoadingBackend(false);
    }
  }

  async function runBackendAction(action: "reset" | "start" | "fail-security" | "approve") {
    setActiveAction(action);
    try {
      const response = await fetch(`/api/runs/${demoRunId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      const run = (await response.json()) as ReleaseRunResponse;
      applyRunResponse(run);
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              GraphFlow
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              Release Intelligence Command Center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              A graph-native release workflow that computes blockers, critical path, and downstream
              impact while execution state changes in real time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => runBackendAction("start")}
              disabled={Boolean(activeAction)}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              {activeAction === "start" ? "Starting" : "Start Release"}
            </button>
            <button
              onClick={loadBackendRun}
              disabled={isLoadingBackend || Boolean(activeAction)}
              className="rounded-md border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {isLoadingBackend ? "Loading" : "Load Backend Run"}
            </button>
            <button
              onClick={() => runBackendAction("fail-security")}
              disabled={Boolean(activeAction)}
              className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {activeAction === "fail-security" ? "Failing" : "Inject Failure"}
            </button>
            <button
              onClick={() => runBackendAction("approve")}
              disabled={!waitingNode || Boolean(activeAction)}
              className="rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {activeAction === "approve" ? "Approving" : "Approve"}
            </button>
            <button
              onClick={() => runBackendAction("reset")}
              disabled={Boolean(activeAction)}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {activeAction === "reset" ? "Resetting" : "Reset"}
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-5 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Release graph</h2>
              <p className="text-sm text-slate-500">Aurora PostgreSQL stores nodes and edges.</p>
            </div>
            <div className="flex gap-2 text-xs font-medium text-slate-600">
              <span>{completedCount}/7 complete</span>
              <span>{blockedCount} blocked</span>
            </div>
          </div>

          <div className="relative h-[460px] overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {releaseEdges.map((edge) => {
                const from = releaseNodes.find((node) => node.id === edge.from)!;
                const to = releaseNodes.find((node) => node.id === edge.to)!;
                const active = statuses[from.id] === "success" || statuses[to.id] !== "pending";
                return (
                  <line
                    key={`${edge.from}-${edge.to}`}
                    x1={from.x + 5}
                    y1={from.y + 2}
                    x2={to.x}
                    y2={to.y + 2}
                    stroke={active ? "#0f766e" : "#cbd5e1"}
                    strokeWidth="0.7"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {releaseNodes.map((node) => {
              const status = statuses[node.id];
              const isCritical = criticalPath.path.includes(node.id);

              return (
                <div
                  key={node.id}
                  className={`absolute w-36 rounded-md border-2 p-3 shadow-sm ${statusStyles[status]}`}
                  style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%, -50%)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{node.label}</p>
                      <p className="mt-1 text-xs opacity-75">{node.duration} min</p>
                    </div>
                    {isCritical ? (
                      <span className="rounded bg-slate-950 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        CP
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs font-semibold">{statusLabels[status]}</p>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Decision summary</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Critical path
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {criticalPath.path.map((id) => releaseNodes.find((node) => node.id === id)?.label).join(" -> ")}
                </p>
                <p className="mt-1 text-sm text-slate-600">{criticalPath.minutes} minute planned path.</p>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Bottleneck
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {failedNode
                    ? `${failedNode.label} is blocking production.`
                    : waitingNode
                      ? `${waitingNode.label} is waiting for approval.`
                      : "No active blocker detected."}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {failedNode
                    ? `${blockedCount} downstream nodes are blocked by graph dependencies.`
                    : waitingNode
                      ? "Deploy steps cannot unlock until the approval node succeeds."
                      : "Execution can continue on every unblocked branch."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Event stream</h2>
            <p className="mt-1 text-sm text-slate-500">
              {backendSource === "dynamodb"
                ? "Loaded from DynamoDB GraphFlowRuns."
                : "Using local fallback until AWS env vars are configured."}
            </p>
            <div className="mt-4 space-y-2">
              {eventLog.map((event, index) => (
                <div key={`${event}-${index}`} className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  {event}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">Hackathon architecture</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {["Vercel UI", "Aurora graph", "DynamoDB runs", "Lambda nodes", "EventBridge events", "AWS screenshot"].map(
                (item) => (
                  <div key={item} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-medium">
                    {item}
                  </div>
                ),
              )}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
