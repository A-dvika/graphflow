"use client";

import { useMemo, useState } from "react";
import {
  findCriticalPath,
  initialStatuses,
  releaseEdges,
  releaseNodes,
  type Status,
} from "@/lib/graphflow";
import { ReleaseGraphD3 } from "@/components/release-graph-d3";
import { GatePanel } from "@/components/gate-panel";
import { EventTimeline } from "@/components/event-timeline";



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
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="border-b border-[var(--border-color)] bg-[var(--card-bg)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--success-green)]">
              GraphFlow
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[var(--foreground)]">
              Release Intelligence Command Center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
              A graph-native release workflow that computes blockers, critical path, and downstream
              impact while execution state changes in real time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => runBackendAction("start")}
              disabled={Boolean(activeAction)}
              className="rounded-md bg-[var(--primary-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeAction === "start" ? "Starting" : "Start Release"}
            </button>
            <button
              onClick={loadBackendRun}
              disabled={isLoadingBackend || Boolean(activeAction)}
              className="rounded-md border border-[var(--primary-blue)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--primary-blue)] transition hover:bg-[rgba(59,130,246,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingBackend ? "Loading" : "Load Backend Run"}
            </button>
            <button
              onClick={() => runBackendAction("fail-security")}
              disabled={Boolean(activeAction)}
              className="rounded-md border border-[var(--error-red)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--error-red)] transition hover:bg-[rgba(239,68,68,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeAction === "fail-security" ? "Failing" : "Inject Failure"}
            </button>
            <button
              onClick={() => runBackendAction("approve")}
              disabled={!waitingNode || Boolean(activeAction)}
              className="rounded-md border border-[var(--success-green)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--success-green)] transition hover:bg-[rgba(16,185,129,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeAction === "approve" ? "Approving" : "Approve"}
            </button>
            <button
              onClick={() => runBackendAction("reset")}
              disabled={Boolean(activeAction)}
              className="rounded-md border border-[var(--border-color)] bg-transparent px-4 py-2 text-sm font-semibold text-gray-300 transition hover:bg-[var(--card-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeAction === "reset" ? "Resetting" : "Reset"}
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-5 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Release graph</h2>
              <p className="text-sm text-gray-400">Aurora PostgreSQL stores nodes and edges.</p>
            </div>
            <div className="flex gap-4 text-xs font-medium text-gray-300">
              <span>
                <span className="text-[var(--success-green)]">{completedCount}</span>
                <span className="text-gray-500">/{releaseNodes.length} complete</span>
              </span>
              <span>
                <span className="text-[var(--warning-orange)]">{blockedCount}</span>
                <span className="text-gray-500"> blocked</span>
              </span>
            </div>
          </div>

          <div className="h-[460px] rounded-md overflow-hidden">
            <ReleaseGraphD3 statuses={statuses} />
          </div>
        </div>

        <aside className="space-y-4">
          <GatePanel statuses={statuses} />

          <EventTimeline events={eventLog} backendSource={backendSource} />

          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
            <h2 className="text-base font-semibold">Hackathon architecture</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {["Vercel UI", "Aurora graph", "DynamoDB runs", "Lambda nodes", "EventBridge events", "AWS screenshot"].map(
                (item) => (
                  <div key={item} className="rounded-md border border-[var(--border-color)] bg-[var(--background)] px-3 py-2 font-medium text-gray-300">
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
