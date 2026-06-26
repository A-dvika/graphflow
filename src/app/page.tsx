"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { Dashboard } from "@/components/dashboard";

export default function Home() {
  return (
    <div className="flex h-screen bg-[var(--background)]">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <AppHeader />

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-[var(--foreground)]">Release Overview</h1>
              <p className="text-[var(--foreground-secondary)] mt-2">
                Monitor and manage your deployment pipeline with real-time quality gate validation
              </p>
            </div>
            <Dashboard />
          </div>
        </div>
      </div>
    </div>
  );
}
