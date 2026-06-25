"use client";

import { useMemo, useState } from "react";
import {
  downstreamOf,
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

export default function Home() {
  const [statuses, setStatuses] = useState<Record<string, Status>>(initialStatuses);
  const [eventLog, setEventLog] = useState<string[]>([
    "Release graph loaded from Aurora PostgreSQL template.",
  ]);
  const criticalPath = useMemo(() => findCriticalPath(), []);
  const blockedCount = Object.values(statuses).filter((status) => status === "blocked").length;
  const completedCount = Object.values(statuses).filter((status) => status === "success").length;
  const waitingNode = releaseNodes.find((node) => statuses[node.id] === "waiting");
  const failedNode = releaseNodes.find((node) => statuses[node.id] === "failed");

  function appendLog(message: string) {
    setEventLog((current) => [message, ...current].slice(0, 8));
  }

  function startRelease() {
    setStatuses({
      ...initialStatuses,
      build: "running",
    });
    setEventLog(["Run started. Lambda worker picked up Build node."]);

    window.setTimeout(() => {
      setStatuses((current) => ({
        ...current,
        build: "success",
        unit: "running",
        scan: "running",
      }));
      appendLog("Build succeeded. EventBridge unlocked Unit Tests and Security Scan.");
    }, 900);

    window.setTimeout(() => {
      setStatuses((current) => ({
        ...current,
        unit: "success",
      }));
      appendLog("Unit Tests completed in 7 minutes.");
    }, 1800);

    window.setTimeout(() => {
      setStatuses((current) => ({
        ...current,
        scan: "success",
        approval: "waiting",
      }));
      appendLog("Security Scan passed. Release Approval is waiting on humans.");
    }, 2600);
  }

  function injectFailure() {
    const impacted = downstreamOf("scan");
    setStatuses((current) => {
      const next: Record<string, Status> = { ...current, scan: "failed" };
      impacted.forEach((id) => {
        next[id] = "blocked";
      });
      return next;
    });
    appendLog("Security Scan failed. GraphFlow blocked every downstream production step.");
  }

  function approveRelease() {
    setStatuses((current) => ({
      ...current,
      approval: "success",
      staging: "running",
      smoke: "running",
    }));
    appendLog("Approval granted. Staging and Smoke Test started in parallel.");

    window.setTimeout(() => {
      setStatuses((current) => ({
        ...current,
        staging: "success",
        smoke: "success",
        prod: "running",
      }));
      appendLog("Parallel checks complete. Production deploy unlocked.");
    }, 900);

    window.setTimeout(() => {
      setStatuses((current) => ({
        ...current,
        prod: "success",
      }));
      appendLog("Production deploy succeeded. Release is complete.");
    }, 1700);
  }

  function resetRelease() {
    setStatuses(initialStatuses);
    setEventLog(["Release graph loaded from Aurora PostgreSQL template."]);
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
              onClick={startRelease}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Start Release
            </button>
            <button
              onClick={injectFailure}
              className="rounded-md border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              Inject Failure
            </button>
            <button
              onClick={approveRelease}
              disabled={!waitingNode}
              className="rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              Approve
            </button>
            <button
              onClick={resetRelease}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reset
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
            <p className="mt-1 text-sm text-slate-500">DynamoDB stores state changes per run.</p>
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
