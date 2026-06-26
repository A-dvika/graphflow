'use client'

import React from 'react'
import { ReleaseRun, GateVerdict } from '@/lib/types'
import { CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react'

interface GatePanelProps {
  release: ReleaseRun
}

export function GatePanel({ release }: GatePanelProps) {
  const verdictConfig = {
    PASS: {
      color: 'bg-[oklch(0.65_0.20_142)]',
      textColor: 'text-card',
      icon: CheckCircle2,
      label: 'RELEASE SAFE',
    },
    WARN: {
      color: 'bg-[oklch(0.70_0.20_48)]',
      textColor: 'text-card',
      icon: AlertCircle,
      label: 'CAUTION REQUIRED',
    },
    FAIL: {
      color: 'bg-[oklch(0.62_0.22_27)]',
      textColor: 'text-foreground',
      icon: XCircle,
      label: 'RELEASE BLOCKED',
    },
  } as Record<
    GateVerdict,
    {
      color: string
      textColor: string
      icon: any
      label: string
    }
  >

  const config = verdictConfig[release.verdict]
  const Icon = config.icon

  const passedChecks = release.nodes.filter((n) => n.status === 'success').length
  const totalChecks = release.nodes.length

  return (
    <div className="space-y-4">
      {/* Verdict Badge */}
      <div className={`${config.color} rounded-lg p-6 text-center`}>
        <div className="flex items-center justify-center gap-3 mb-2">
          <Icon className="w-8 h-8" />
          <span className="text-2xl font-bold">{config.label}</span>
        </div>
        <p className="text-sm opacity-90">{release.verdict === 'PASS' ? 'Ready for production' : 'Review before proceeding'}</p>
      </div>

      {/* Project Info */}
      <div className="bg-card rounded-lg p-4 space-y-3 border border-border">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Project</p>
          <p className="text-lg font-semibold">{release.projectName}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Branch</p>
            <p className="text-sm font-mono">{release.branchName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Environment</p>
            <p className="text-sm capitalize">{release.environment}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Commit</p>
          <p className="text-xs font-mono text-muted-foreground">
            {release.commitHash.slice(0, 12)} - {release.commitMessage}
          </p>
        </div>
      </div>

      {/* Checks Status */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <span className="text-primary">✓</span> Required Checks
        </h3>
        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted-foreground">
              {passedChecks} of {totalChecks} passed
            </span>
            <span className="text-xs font-mono text-foreground">
              {Math.round((passedChecks / totalChecks) * 100)}%
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${(passedChecks / totalChecks) * 100}%` }}
            />
          </div>
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {release.nodes.map((node) => (
            <div
              key={node.id}
              className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-secondary transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  node.status === 'success'
                    ? 'bg-[oklch(0.65_0.20_142)]'
                    : node.status === 'failed' || node.status === 'blocked'
                      ? 'bg-[oklch(0.62_0.22_27)]'
                      : node.status === 'running'
                        ? 'bg-[oklch(0.60_0.20_264)]'
                        : 'bg-muted'
                }`}
              />
              <span className="flex-1">{node.label}</span>
              <span className="text-muted-foreground">
                {node.status === 'success'
                  ? '✓'
                  : node.status === 'failed' || node.status === 'blocked'
                    ? '✕'
                    : node.status === 'running'
                      ? '◆'
                      : '○'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Issues */}
      {(release.failedChecks.length > 0 ||
        release.blockedChecks.length > 0 ||
        release.waitingChecks.length > 0) && (
        <div className="bg-card rounded-lg p-4 border border-border">
          {release.failedChecks.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-[oklch(0.62_0.22_27)] uppercase tracking-wide mb-2">
                Failed Checks
              </h4>
              <div className="space-y-1">
                {release.failedChecks.map((check) => (
                  <div key={check} className="text-xs text-muted-foreground">
                    ✕ {check}
                  </div>
                ))}
              </div>
            </div>
          )}
          {release.blockedChecks.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-semibold text-[oklch(0.62_0.22_27)] uppercase tracking-wide mb-2">
                Blocked
              </h4>
              <div className="space-y-1">
                {release.blockedChecks.map((check) => (
                  <div key={check} className="text-xs text-muted-foreground">
                    ⊘ {check}
                  </div>
                ))}
              </div>
            </div>
          )}
          {release.waitingChecks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[oklch(0.70_0.20_48)] uppercase tracking-wide mb-2">
                Awaiting
              </h4>
              <div className="space-y-1">
                {release.waitingChecks.map((check) => (
                  <div key={check} className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" /> {check}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
