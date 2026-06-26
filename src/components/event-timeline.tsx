"use client";

interface EventTimelineProps {
  events: string[];
  backendSource: "dynamodb" | "demo-fallback";
}

export function EventTimeline({ events, backendSource }: EventTimelineProps) {
  const formatTime = (index: number) => {
    const now = new Date();
    const secondsAgo = index * 15;
    const time = new Date(now.getTime() - secondsAgo * 1000);
    return time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const getEventIcon = (event: string) => {
    if (event.includes("complete") || event.includes("Success")) return "✓";
    if (event.includes("Failed") || event.includes("fail")) return "✕";
    if (event.includes("Running") || event.includes("loaded")) return "▶";
    if (event.includes("Pending") || event.includes("Waiting")) return "⏸";
    return "•";
  };

  const getEventColor = (event: string) => {
    if (event.includes("Success") || event.includes("complete")) return "var(--success-green)";
    if (event.includes("Failed") || event.includes("fail")) return "var(--error-red)";
    if (event.includes("Running") || event.includes("loaded")) return "var(--primary-blue)";
    if (event.includes("Waiting") || event.includes("Blocked")) return "var(--warning-orange)";
    return "var(--pending-purple)";
  };

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] p-4 h-96 flex flex-col">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Event Timeline</h2>
        <p className="text-xs text-gray-400 mt-1">
          {backendSource === "dynamodb"
            ? "Loaded from DynamoDB GraphFlowRuns."
            : "Using local fallback until AWS env vars are configured."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {events.length > 0 ? (
          events.map((event, index) => (
            <div key={`${event}-${index}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                  style={{ borderColor: getEventColor(event), color: getEventColor(event) }}
                >
                  {getEventIcon(event)}
                </div>
                {index < events.length - 1 && (
                  <div
                    className="w-0.5 h-8 mt-1"
                    style={{ backgroundColor: "var(--border-color)" }}
                  />
                )}
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm text-gray-300 break-words">{event}</p>
                <p className="text-xs text-gray-500 mt-1">{formatTime(index)}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No events yet
          </div>
        )}
      </div>
    </div>
  );
}
