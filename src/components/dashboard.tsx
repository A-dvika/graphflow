"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  GitBranch,
  Server,
  TrendingUp,
  ChevronRight,
  RefreshCw,
  Play,
} from "lucide-react";
import { ReleaseFlowGraph } from "./release-flow-graph";

interface Release {
  id: string;
  version: string;
  status: "ready" | "in-progress" | "completed" | "failed";
  branch: string;
  environment: string;
  progress: number;
  completedGates: number;
  totalGates: number;
  author: string;
  timestamp: string;
}

interface QualityGate {
  id: string;
  name: string;
  status: "passed" | "pending" | "failed";
}

const mockReleases: Release[] = [
  {
    id: "v2.4.0",
    version: "2.4.0",
    status: "in-progress",
    branch: "main",
    environment: "staging",
    progress: 62,
    completedGates: 5,
    totalGates: 8,
    author: "Sarah Chen",
    timestamp: "2 min ago",
  },
  {
    id: "v2.3.5",
    version: "2.3.5",
    status: "completed",
    branch: "release/2.3.5",
    environment: "production",
    progress: 100,
    completedGates: 8,
    totalGates: 8,
    author: "Alex Rodriguez",
    timestamp: "1 hour ago",
  },
  {
    id: "v2.3.4",
    version: "2.3.4",
    status: "failed",
    branch: "release/2.3.4",
    environment: "production",
    progress: 37,
    completedGates: 3,
    totalGates: 8,
    author: "Jordan Kim",
    timestamp: "4 hours ago",
  },
];

const qualityGates: QualityGate[] = [
  { id: "unit-tests", name: "Unit Tests", status: "passed" },
  { id: "integration", name: "Integration Tests", status: "passed" },
  { id: "security", name: "Security Scan", status: "pending" },
  { id: "performance", name: "Performance Baseline", status: "passed" },
  { id: "compliance", name: "Compliance Check", status: "passed" },
  { id: "approval", name: "Manual Approval", status: "pending" },
];

export function Dashboard() {
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(mockReleases[0]);
  const [activeTab, setActiveTab] = useState("releases");

  const stats = [
    {
      icon: Activity,
      label: "Active Releases",
      value: "3",
      change: "+12%",
      color: "text-[var(--status-pending)]",
    },
    {
      icon: CheckCircle2,
      label: "Deployments Today",
      value: "12",
      change: "+8%",
      color: "text-[var(--status-success)]",
    },
    {
      icon: AlertCircle,
      label: "Failed Gates",
      value: "1",
      change: "-5%",
      color: "text-[var(--status-error)]",
    },
    {
      icon: TrendingUp,
      label: "Success Rate",
      value: "94%",
      change: "+2%",
      color: "text-[var(--status-success)]",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-[var(--status-success)] text-[var(--background)]";
      case "in-progress":
        return "bg-[var(--status-pending)] text-[var(--background)]";
      case "completed":
        return "bg-[var(--status-success)] text-[var(--background)]";
      case "failed":
        return "bg-[var(--status-error)] text-white";
      case "passed":
        return "bg-[var(--status-success)] text-[var(--background)]";
      case "pending":
        return "bg-[var(--status-warning)] text-[var(--background)]";
      default:
        return "bg-[var(--status-neutral)]";
    }
  };

  const getGateIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "failed":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert */}
      <div className="border border-[var(--status-warning)] bg-[var(--status-warning)]/10 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-[var(--status-warning)] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[var(--foreground)]">
          Release v2.4.0 is in progress. Security scan is running. Estimated completion in 3 minutes.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-[var(--foreground-secondary)]">{stat.label}</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-2xl font-bold text-[var(--foreground)]">{stat.value}</p>
                    <span className="text-xs text-[var(--status-success)]">{stat.change}</span>
                  </div>
                </div>
                <div className={`${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Tabs */}
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab("releases")}
            className={`px-4 py-3 border-b-2 font-medium transition-colors ${
              activeTab === "releases"
                ? "border-[var(--status-pending)] text-[var(--foreground)]"
                : "border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            Recent Releases
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`px-4 py-3 border-b-2 font-medium transition-colors ${
              activeTab === "pipeline"
                ? "border-[var(--status-pending)] text-[var(--foreground)]"
                : "border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setActiveTab("gates")}
            className={`px-4 py-3 border-b-2 font-medium transition-colors ${
              activeTab === "gates"
                ? "border-[var(--status-pending)] text-[var(--foreground)]"
                : "border-transparent text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            Quality Gates
          </button>
        </div>

        {/* Releases Tab */}
        {activeTab === "releases" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Release List */}
              <div className="lg:col-span-2 space-y-3">
                {mockReleases.map((release) => (
                  <div
                    key={release.id}
                    className={`bg-[var(--surface)] border-[var(--border)] border cursor-pointer transition-all rounded-lg p-4 ${
                      selectedRelease?.id === release.id ? "ring-2 ring-[var(--status-pending)]" : ""
                    }`}
                    onClick={() => setSelectedRelease(release)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-[var(--foreground)]">v{release.version}</h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(release.status)}`}>
                              {release.status.replace("-", " ").toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--foreground-secondary)] mt-1">Release ID: {release.id}</p>
                        </div>
                        <span className="text-xs text-[var(--foreground-secondary)]">{release.timestamp}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-[var(--foreground-secondary)]">
                          <GitBranch className="w-4 h-4" />
                          <span>{release.branch}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[var(--foreground-secondary)]">
                          <Server className="w-4 h-4" />
                          <span>{release.environment}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--foreground-secondary)]">Quality Gates Progress</span>
                          <span className="text-[var(--foreground)]">{release.completedGates}/{release.totalGates}</span>
                        </div>
                        <div className="w-full bg-[var(--background)] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[var(--status-pending)] h-full transition-all"
                            style={{ width: `${release.progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-[var(--foreground-secondary)]">by {release.author}</span>
                        <ChevronRight className="w-4 h-4 text-[var(--foreground-secondary)]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Release Details */}
              {selectedRelease && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg h-fit p-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)] mb-1">Release Details</h3>
                      <p className="text-xs text-[var(--foreground-secondary)]">v{selectedRelease.version}</p>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b border-[var(--border)]">
                        <span className="text-[var(--foreground-secondary)]">Status</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedRelease.status)}`}>
                          {selectedRelease.status.replace("-", " ")}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[var(--border)]">
                        <span className="text-[var(--foreground-secondary)]">Environment</span>
                        <span className="text-[var(--foreground)]">{selectedRelease.environment}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-[var(--border)]">
                        <span className="text-[var(--foreground-secondary)]">Branch</span>
                        <span className="text-[var(--foreground)] font-mono text-xs">{selectedRelease.branch}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-[var(--foreground-secondary)]">Author</span>
                        <span className="text-[var(--foreground)]">{selectedRelease.author}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-[var(--border)]">
                      <button className="w-full bg-[var(--status-pending)] text-[var(--background)] py-2 rounded-lg font-medium text-sm hover:bg-[var(--status-pending)]/90 flex items-center justify-center gap-2">
                        <Play className="w-4 h-4" />
                        View Details
                      </button>
                      <button className="w-full border border-[var(--border)] text-[var(--foreground)] py-2 rounded-lg font-medium text-sm hover:bg-[var(--surface)] flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pipeline Tab */}
        {activeTab === "pipeline" && <ReleaseFlowGraph />}

        {/* Quality Gates Tab */}
        {activeTab === "gates" && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1">Quality Gates Status</h3>
              <p className="text-sm text-[var(--foreground-secondary)]">Current deployment requirements and validation status</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {qualityGates.map((gate) => (
                <div key={gate.id} className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--status-pending)] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getStatusColor(gate.status)}`}>
                        {getGateIcon(gate.status)}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--foreground)] text-sm">{gate.name}</p>
                        <p className="text-xs text-[var(--foreground-secondary)]">
                          {gate.status.charAt(0).toUpperCase() + gate.status.slice(1)}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(gate.status)}`}>
                      {gate.status === "passed" ? "PASSED" : gate.status === "pending" ? "PENDING" : "FAILED"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
