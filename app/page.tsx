'use client'

import React, { useState } from 'react'
import { ReleaseGraph } from '@/components/release-graph'
import { GatePanel } from '@/components/gate-panel'
import { EventTimeline } from '@/components/event-timeline'
import { MOCK_RELEASE_RUN, MOCK_TIMELINE_EVENTS } from '@/lib/mock-data'

export default function DashboardPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const release = MOCK_RELEASE_RUN

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="px-6 py-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                GraphFlow
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Release Quality Gates</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Release Status
              </div>
              <div
                className={`text-sm font-semibold px-3 py-1 rounded-full inline-block ${
                  release.verdict === 'PASS'
                    ? 'bg-[oklch(0.65_0.20_142)]/20 text-[oklch(0.65_0.20_142)]'
                    : release.verdict === 'WARN'
                      ? 'bg-[oklch(0.70_0.20_48)]/20 text-[oklch(0.70_0.20_48)]'
                      : 'bg-[oklch(0.62_0.22_27)]/20 text-[oklch(0.62_0.22_27)]'
                }`}
              >
                {release.verdict}
              </div>
            </div>
          </div>

          {/* Run Info */}
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Run ID</span>
              <p className="font-mono text-foreground">{release.id}</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div>
              <span className="text-muted-foreground">Branch</span>
              <p className="text-foreground font-medium">{release.branchName}</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div>
              <span className="text-muted-foreground">Started</span>
              <p className="text-foreground font-medium">
                {new Intl.DateTimeFormat('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }).format(release.startedAt)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Graph Visualization */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-lg border border-border p-4">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <span>📊</span> Release Workflow Graph
              </h2>
              <ReleaseGraph
                nodes={release.nodes}
                selectedNodeId={selectedNodeId}
                onNodeSelect={setSelectedNodeId}
              />
            </div>

            {/* Node Details */}
            {selectedNodeId && (
              <div className="mt-6 bg-card rounded-lg border border-border p-4">
                {(() => {
                  const node = release.nodes.find((n) => n.id === selectedNodeId)
                  if (!node) return null

                  return (
                    <div>
                      <h3 className="text-sm font-semibold mb-4">Node Details</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide">
                            Name
                          </p>
                          <p className="font-medium mt-1">{node.label}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide">
                            Status
                          </p>
                          <p className="font-medium mt-1 capitalize">{node.status}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide">
                            Type
                          </p>
                          <p className="font-medium mt-1 capitalize">{node.type}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide">
                            Duration
                          </p>
                          <p className="font-medium mt-1">
                            {node.duration
                              ? `${Math.round(node.duration / 60)}m`
                              : 'N/A'}
                          </p>
                        </div>
                        {node.dependencies.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground text-xs uppercase tracking-wide">
                              Dependencies
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {node.dependencies.map((dep) => (
                                <span
                                  key={dep}
                                  className="px-2 py-1 rounded bg-secondary text-xs font-mono cursor-pointer hover:bg-secondary/80"
                                  onClick={() => setSelectedNodeId(dep)}
                                >
                                  {dep}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {node.error && (
                          <div className="col-span-2 bg-[oklch(0.62_0.22_27)]/10 rounded p-3 border border-[oklch(0.62_0.22_27)]/30">
                            <p className="text-xs text-[oklch(0.62_0.22_27)] font-mono">
                              {node.error}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Event Timeline */}
            <div className="mt-6">
              <EventTimeline events={MOCK_TIMELINE_EVENTS} />
            </div>
          </div>

          {/* Right: Gate Decision Panel */}
          <div>
            <GatePanel release={release} />
          </div>
        </div>
      </div>
    </div>
  )
}
