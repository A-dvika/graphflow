"use client";

import React from "react";
import { ReleaseCard } from "./release-card";

export function QualityGatesDashboard() {
  const releases = [
    {
      releaseId: "v2.4.1",
      version: "2.4.1",
      branch: "main",
      environment: "Production",
      status: "success" as const,
      progress: 100,
      timestamp: "2 hours ago",
      author: "Sarah Chen",
      checksPass: 12,
      checksTotal: 12,
    },
    {
      releaseId: "v2.4.0",
      version: "2.4.0",
      branch: "release/v2.4",
      environment: "Staging",
      status: "pending" as const,
      progress: 75,
      timestamp: "15 minutes ago",
      author: "Alex Rodriguez",
      checksPass: 9,
      checksTotal: 12,
    },
    {
      releaseId: "v2.3.9",
      version: "2.3.9",
      branch: "hotfix/security",
      environment: "Production",
      status: "warning" as const,
      progress: 50,
      timestamp: "1 hour ago",
      author: "Maria Garcia",
      checksPass: 6,
      checksTotal: 12,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active Releases", value: "3", icon: "🚀", color: "pending" },
          { label: "Deployments Today", value: "12", icon: "✅", color: "success" },
          { label: "Failed Gates", value: "1", icon: "⚠️", color: "warning" },
          { label: "Quality Score", value: "94%", icon: "📊", color: "success" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg p-4">
            <p className="text-sm text-[var(--foreground-secondary)] mb-2">{stat.label}</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-[var(--foreground)]">{stat.value}</p>
              <span className="text-2xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Release Cards */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Recent Releases</h2>
        <div className="grid grid-cols-1 gap-4">
          {releases.map((release) => (
            <ReleaseCard key={release.releaseId} {...release} />
          ))}
        </div>
      </div>

      {/* Gate Details */}
      <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Required Quality Gates</h2>
        <div className="space-y-3">
          {[
            { name: "Unit Tests", status: "success", time: "2m 34s" },
            { name: "Integration Tests", status: "success", time: "5m 12s" },
            { name: "Security Scan", status: "success", time: "1m 45s" },
            { name: "Performance Baseline", status: "pending", time: "In progress..." },
            { name: "Approval Gate", status: "warning", time: "Awaiting approval" },
          ].map((gate) => (
            <div key={gate.name} className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg">
              <div className="flex items-center gap-3">
                <span className={`dot ${gate.status}`}></span>
                <p className="text-sm font-medium text-[var(--foreground)]">{gate.name}</p>
              </div>
              <p className="text-xs text-[var(--foreground-secondary)]">{gate.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
