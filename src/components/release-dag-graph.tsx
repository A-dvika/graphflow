"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Clock, ArrowRight } from "lucide-react";

interface Job {
  id: string;
  name: string;
  status: "passed" | "failed" | "running" | "pending";
  duration: string;
  tags: string[];
  inputs: number;
  outputs: number;
}

interface Stage {
  id: string;
  name: string;
  number: number;
  jobs: Job[];
}

interface DependencyLink {
  from: string;
  to: string;
}

const mockStages: Stage[] = [
  {
    id: "stage-1",
    name: "Build",
    number: 1,
    jobs: [
      {
        id: "build-1",
        name: "Build",
        status: "passed",
        duration: "4m",
        tags: ["Compute", "Critical"],
        inputs: 0,
        outputs: 2,
      },
    ],
  },
  {
    id: "stage-2",
    name: "Risk checks",
    number: 2,
    jobs: [
      {
        id: "tests-1",
        name: "Unit Tests",
        status: "passed",
        duration: "7m",
        tags: ["Quality"],
        inputs: 1,
        outputs: 1,
      },
      {
        id: "security-1",
        name: "Security Scan",
        status: "failed",
        duration: "9m",
        tags: ["Security", "Critical"],
        inputs: 1,
        outputs: 1,
      },
    ],
  },
  {
    id: "stage-3",
    name: "Deployment",
    number: 3,
    jobs: [
      {
        id: "deploy-staging",
        name: "Deploy Staging",
        status: "pending",
        duration: "-",
        tags: ["Infrastructure"],
        inputs: 2,
        outputs: 1,
      },
      {
        id: "deploy-prod",
        name: "Deploy Production",
        status: "pending",
        duration: "-",
        tags: ["Infrastructure", "Critical"],
        inputs: 1,
        outputs: 0,
      },
    ],
  },
];

const dependencies: DependencyLink[] = [
  { from: "build-1", to: "tests-1" },
  { from: "build-1", to: "security-1" },
  { from: "tests-1", to: "deploy-staging" },
  { from: "security-1", to: "deploy-staging" },
  { from: "deploy-staging", to: "deploy-prod" },
];

function getStatusColor(status: string): { border: string; bg: string; text: string } {
  switch (status) {
    case "passed":
      return {
        border: "border-[var(--status-success)]",
        bg: "bg-[var(--status-success)]/5",
        text: "text-[var(--status-success)]",
      };
    case "failed":
      return {
        border: "border-[var(--status-error)]",
        bg: "bg-[var(--status-error)]/5",
        text: "text-[var(--status-error)]",
      };
    case "running":
      return {
        border: "border-[var(--status-pending)]",
        bg: "bg-[var(--status-pending)]/5",
        text: "text-[var(--status-pending)]",
      };
    default:
      return {
        border: "border-[var(--border)]",
        bg: "bg-[var(--background)]",
        text: "text-[var(--foreground-secondary)]",
      };
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "passed":
      return <CheckCircle2 className="w-5 h-5" />;
    case "failed":
      return <AlertCircle className="w-5 h-5" />;
    case "running":
      return <Clock className="w-5 h-5 animate-spin" />;
    default:
      return <Clock className="w-5 h-5" />;
  }
}

function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ReleaseDagGraph() {
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-[var(--foreground)]">Release Pipeline</h3>
        <p className="text-sm text-[var(--foreground-secondary)] mt-1">
          Directed acyclic graph showing deployment workflow stages and dependencies
        </p>
      </div>

      {/* DAG Graph */}
      <div className="overflow-x-auto pb-4">
        <div className="inline-flex gap-8 min-w-full">
          {mockStages.map((stage, stageIndex) => (
            <React.Fragment key={stage.id}>
              {/* Stage Container */}
              <div className="flex-shrink-0">
                <div className="border border-[var(--border)] rounded-lg bg-[var(--background)] p-6 min-w-max">
                  {/* Stage Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase text-[var(--foreground-secondary)] tracking-wider">
                        Stage {stage.number}
                      </p>
                      <h4 className="text-lg font-bold text-[var(--foreground)] mt-1">{stage.name}</h4>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--status-pending)]/20 border border-[var(--status-pending)]">
                      <span className="text-sm font-bold text-[var(--status-pending)]">{stage.number}</span>
                    </div>
                  </div>

                  {/* Jobs in Stage */}
                  <div className="space-y-3">
                    {stage.jobs.map((job) => {
                      const colors = getStatusColor(job.status);
                      return (
                        <button
                          key={job.id}
                          onClick={() => setSelectedJob(job)}
                          className={`w-full rounded-lg border-2 ${colors.border} ${colors.bg} p-4 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--status-pending)]`}
                        >
                          {/* Status Header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={colors.text}>{getStatusIcon(job.status)}</span>
                              <span className={`text-xs font-bold uppercase ${colors.text}`}>
                                {getStatusLabel(job.status)}
                              </span>
                            </div>
                            <span className={`text-xs font-semibold ${colors.text}`}>{job.duration}</span>
                          </div>

                          {/* Job Name */}
                          <h5 className="text-sm font-bold text-[var(--foreground)] mb-3">{job.name}</h5>

                          {/* Tags */}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {job.tags.map((tag) => (
                              <span
                                key={tag}
                                className={`inline-block text-[10px] px-2 py-1 rounded ${
                                  tag === "Critical"
                                    ? "bg-[var(--status-error)]/20 text-[var(--status-error)]"
                                    : "bg-[var(--status-pending)]/20 text-[var(--status-pending)]"
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          {/* I/O */}
                          <div className="flex justify-between text-xs text-[var(--foreground-secondary)]">
                            <span>{job.inputs} in</span>
                            <span>{job.outputs} out</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Connection Arrow */}
              {stageIndex < mockStages.length - 1 && (
                <div className="flex items-center justify-center flex-shrink-0 w-20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full border-2 border-[var(--status-pending)] bg-[var(--status-pending)]/10 flex items-center justify-center hover:shadow-lg transition-shadow">
                      <ArrowRight className="w-5 h-5 text-[var(--status-pending)]" />
                    </div>
                    <div className="text-xs font-bold text-[var(--status-pending)] bg-[var(--background)] px-2">
                      {dependencies.filter(
                        (d) =>
                          mockStages[stageIndex].jobs.some((j) => j.id === d.from) &&
                          mockStages[stageIndex + 1].jobs.some((j) => j.id === d.to)
                      ).length}{" "}
                      links
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Selected Job Details Panel */}
      {selectedJob && (
        <div className="border-t border-[var(--border)] pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-bold text-[var(--foreground)]">Job Details: {selectedJob.name}</h4>
            <button
              onClick={() => setSelectedJob(null)}
              className="text-[var(--foreground-secondary)] hover:text-[var(--foreground)] text-xs font-semibold"
            >
              CLOSE
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-[var(--background)] border border-[var(--border)] p-3">
              <p className="text-xs text-[var(--foreground-secondary)] font-bold uppercase">Status</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={getStatusColor(selectedJob.status).text}>
                  {getStatusIcon(selectedJob.status)}
                </span>
                <p className="font-semibold text-[var(--foreground)]">{getStatusLabel(selectedJob.status)}</p>
              </div>
            </div>

            <div className="rounded-lg bg-[var(--background)] border border-[var(--border)] p-3">
              <p className="text-xs text-[var(--foreground-secondary)] font-bold uppercase">Duration</p>
              <p className="font-bold text-[var(--foreground)] mt-2">{selectedJob.duration}</p>
            </div>

            <div className="rounded-lg bg-[var(--background)] border border-[var(--border)] p-3">
              <p className="text-xs text-[var(--foreground-secondary)] font-bold uppercase">Dependencies</p>
              <p className="font-bold text-[var(--foreground)] mt-2">{selectedJob.inputs}</p>
            </div>

            <div className="rounded-lg bg-[var(--background)] border border-[var(--border)] p-3">
              <p className="text-xs text-[var(--foreground-secondary)] font-bold uppercase">Unlocks</p>
              <p className="font-bold text-[var(--foreground)] mt-2">{selectedJob.outputs}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold text-[var(--foreground-secondary)] uppercase mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {selectedJob.tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-block text-xs px-3 py-1.5 rounded font-medium ${
                    tag === "Critical"
                      ? "bg-[var(--status-error)]/20 text-[var(--status-error)]"
                      : "bg-[var(--status-pending)]/20 text-[var(--status-pending)]"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
