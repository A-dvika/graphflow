import { type FlowNode, type Status } from "@/lib/graphflow";

export type MigrationRiskLevel = "none" | "low" | "medium" | "high";

export type MigrationRisk = {
  present: boolean;
  level: MigrationRiskLevel;
  summary: string;
  nodes: string[];
  reasons: string[];
};

function isMigrationNode(node: FlowNode) {
  const value = `${node.id} ${node.label}`.toLowerCase();

  return value.includes("migration") || value.includes("schema") || value.includes("database") || value.includes("db ");
}

export function analyzeMigrationRisk(input: {
  nodes: FlowNode[];
  statuses: Record<string, Status>;
}): MigrationRisk {
  const migrationNodes = input.nodes.filter(isMigrationNode);

  if (migrationNodes.length === 0) {
    return {
      present: false,
      level: "none",
      summary: "No database migration node detected in this release graph.",
      nodes: [],
      reasons: [],
    };
  }

  const failed = migrationNodes.filter((node) => input.statuses[node.id] === "failed");
  const blocked = migrationNodes.filter((node) => input.statuses[node.id] === "blocked");
  const waiting = migrationNodes.filter((node) => input.statuses[node.id] === "waiting");
  const incomplete = migrationNodes.filter((node) => {
    const status = input.statuses[node.id] ?? "pending";

    return status !== "success" && status !== "failed" && status !== "blocked";
  });

  if (failed.length > 0 || blocked.length > 0) {
    return {
      present: true,
      level: "high",
      summary: "Database migration risk is high because a migration-related node failed or is blocked.",
      nodes: [...failed, ...blocked].map((node) => node.id),
      reasons: [...failed, ...blocked].map((node) => `${node.label} is ${input.statuses[node.id]}.`),
    };
  }

  if (waiting.length > 0 || incomplete.length > 0) {
    const nodes = [...waiting, ...incomplete];

    return {
      present: true,
      level: "medium",
      summary: "Database migration risk needs review before production because migration evidence is incomplete.",
      nodes: nodes.map((node) => node.id),
      reasons: nodes.map((node) => `${node.label} is ${input.statuses[node.id] ?? "pending"}.`),
    };
  }

  return {
    present: true,
    level: "low",
    summary: "Database migration review completed successfully.",
    nodes: migrationNodes.map((node) => node.id),
    reasons: migrationNodes.map((node) => `${node.label} completed successfully.`),
  };
}
