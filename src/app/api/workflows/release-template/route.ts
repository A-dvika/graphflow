import { NextResponse } from "next/server";
import { findCriticalPath, releaseEdges, releaseNodes } from "@/lib/graphflow";

export function GET() {
  return NextResponse.json({
    workflow: {
      id: "release-command-center",
      name: "Production Release",
      description: "Demo workflow stored as graph primitives.",
    },
    nodes: releaseNodes,
    edges: releaseEdges,
    analysis: {
      criticalPath: findCriticalPath(),
    },
    storage: {
      planned: "Aurora PostgreSQL",
      tables: ["workflows", "workflow_nodes", "workflow_edges"],
    },
  });
}
