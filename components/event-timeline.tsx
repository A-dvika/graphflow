'use client'

import React, { useState } from 'react'
import { TimelineEvent } from '@/lib/types'
import { ChevronDown } from 'lucide-react'

interface EventTimelineProps {
  events: TimelineEvent[]
}

export function EventTimeline({ events }: EventTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(date))
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-[oklch(0.62_0.22_27)]'
      case 'warning':
        return 'text-[oklch(0.70_0.20_48)]'
      default:
        return 'text-muted-foreground'
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'node_started':
        return '▶'
      case 'node_completed':
        return '✓'
      case 'node_failed':
        return '✕'
      case 'gate_evaluated':
        return '⊙'
      case 'policy_applied':
        return '⚙'
      default:
        return '•'
    }
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span>📋</span> Event Timeline
        </h3>
      </div>

      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {sortedEvents.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No events yet
          </div>
        ) : (
          sortedEvents.map((event) => (
            <div
              key={event.id}
              className="p-3 hover:bg-secondary transition-colors cursor-pointer"
              onClick={() =>
                setExpandedId(expandedId === event.id ? null : event.id)
              }
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full border border-border flex items-center justify-center text-xs font-bold ${
                    event.severity === 'error'
                      ? 'bg-[oklch(0.62_0.22_27)]/20 text-[oklch(0.62_0.22_27)]'
                      : event.severity === 'warning'
                        ? 'bg-[oklch(0.70_0.20_48)]/20 text-[oklch(0.70_0.20_48)]'
                        : 'bg-primary/20 text-primary'
                  }`}
                >
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-tight">
                        {event.nodeName ? (
                          <>
                            <span className="text-primary">{event.nodeName}</span>
                            <span className="text-muted-foreground"> • </span>
                            <span className="text-muted-foreground">
                              {event.message}
                            </span>
                          </>
                        ) : (
                          <span className="text-foreground">{event.message}</span>
                        )}
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 flex-shrink-0 transition-transform ${
                        expandedId === event.id ? 'rotate-180' : ''
                      } text-muted-foreground`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(event.timestamp)}
                  </p>
                </div>
              </div>

              {expandedId === event.id && (
                <div className="mt-3 ml-9 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
                  <div>
                    <span className="text-muted-foreground">Event ID:</span>{' '}
                    <span className="font-mono">{event.id}</span>
                  </div>
                  {event.nodeId && (
                    <div>
                      <span className="text-muted-foreground">Node ID:</span>{' '}
                      <span className="font-mono">{event.nodeId}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Type:</span>{' '}
                    <span className="font-mono">{event.type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Severity:</span>{' '}
                    <span className={getSeverityColor(event.severity)}>
                      {event.severity}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
