"use client";

import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { QualityGatesDashboard } from "@/components/quality-gates-dashboard";

export default function Home() {
  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header
          title="Release Overview"
          subtitle="Monitor and manage your release quality gates and deployments"
          actions={
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">
                Refresh
              </button>
              <button className="px-4 py-2 rounded-lg bg-[var(--status-pending)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity">
                New Release
              </button>
            </div>
          }
        />

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            <QualityGatesDashboard />
          </div>
        </div>
      </div>
    </div>
  );
}
