import { completeWithAgentModel, type LlmResult } from "@/lib/agent/llm";
import { type GateDecision } from "@/lib/backend/gate";
import { type FlowEdge, type FlowNode, type Status } from "@/lib/graphflow";

export type ReleaseAgentInsight = {
  mode: "llm" | "deterministic";
  headline: string;
  explanation: string;
  nextActions: string[];
  riskAreas: string[];
  model: {
    configured: boolean;
    provider: LlmResult["provider"];
    name: string | null;
    error?: LlmResult["error"];
  };
};

function labelsFor(nodes: FlowNode[], ids: string[]) {
  const byId = new Map(nodes.map((node) => [node.id, node.label]));

  return ids.map((id) => byId.get(id) ?? id);
}

function deterministicInsight(input: {
  gate: GateDecision;
  nodes: FlowNode[];
  model: ReleaseAgentInsight["model"];
}): ReleaseAgentInsight {
  const failed = labelsFor(input.nodes, input.gate.failedNodes);
  const blocked = labelsFor(input.nodes, input.gate.blockedNodes);
  const waiting = labelsFor(input.nodes, input.gate.waitingNodes);

  return {
    mode: "deterministic",
    headline:
      input.gate.verdict === "PASS"
        ? "Release is clear to continue."
        : input.gate.verdict === "FAIL"
          ? "Release should stay blocked."
          : "Release needs attention before production.",
    explanation: input.gate.reasons.join(" "),
    nextActions:
      failed.length > 0
        ? [`Fix or waive ${failed[0]} before production deploy.`, "Re-run the release gate after the upstream failure is resolved."]
        : waiting.length > 0
          ? [`Complete ${waiting[0]} before production deploy.`, "Re-run the release gate after approval is recorded."]
          : ["Keep monitoring the critical path before production deploy."],
    riskAreas: [...failed, ...blocked, ...waiting],
    model: input.model,
  };
}

function parseAgentJson(text: string): Pick<ReleaseAgentInsight, "headline" | "explanation" | "nextActions" | "riskAreas"> | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      headline?: unknown;
      explanation?: unknown;
      nextActions?: unknown;
      riskAreas?: unknown;
    };

    if (typeof parsed.headline !== "string" || typeof parsed.explanation !== "string") {
      return null;
    }

    return {
      headline: parsed.headline.slice(0, 180),
      explanation: parsed.explanation.slice(0, 1000),
      nextActions: Array.isArray(parsed.nextActions)
        ? parsed.nextActions.filter((item): item is string => typeof item === "string").slice(0, 5)
        : [],
      riskAreas: Array.isArray(parsed.riskAreas)
        ? parsed.riskAreas.filter((item): item is string => typeof item === "string").slice(0, 8)
        : [],
    };
  } catch {
    return null;
  }
}

export async function generateReleaseInsight(input: {
  runId: string;
  workflowId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  statuses: Record<string, Status>;
  gate: GateDecision;
}) {
  const system = [
    "You are GraphFlow's release risk agent.",
    "Explain deterministic release-gate results for DevOps and platform engineers.",
    "Do not invent logs, services, owners, timestamps, compliance facts, or external incidents.",
    "Base every recommendation only on the provided graph, statuses, and gate decision.",
    "Return strict JSON with headline, explanation, nextActions, and riskAreas.",
  ].join(" ");
  const prompt = JSON.stringify(
    {
      runId: input.runId,
      workflowId: input.workflowId,
      gate: input.gate,
      graph: {
        nodes: input.nodes.map((node) => ({
          id: node.id,
          label: node.label,
          type: node.type,
          duration: node.duration,
        })),
        edges: input.edges,
      },
      statuses: input.statuses,
      requiredOutput: {
        headline: "one sentence",
        explanation: "short paragraph explaining why the gate passed, warned, or failed",
        nextActions: ["ranked action 1", "ranked action 2"],
        riskAreas: ["node or release area"],
      },
    },
    null,
    2,
  );
  const result = await completeWithAgentModel({
    system,
    prompt,
    maxTokens: 500,
  });
  const model = {
    configured: result.configured,
    provider: result.provider,
    name: result.model,
    ...(result.error ? { error: result.error } : {}),
  };

  if (!result.text) {
    return deterministicInsight({
      gate: input.gate,
      nodes: input.nodes,
      model,
    });
  }

  const parsed = parseAgentJson(result.text);

  if (!parsed) {
    return {
      ...deterministicInsight({
        gate: input.gate,
        nodes: input.nodes,
        model,
      }),
      model,
    };
  }

  return {
    mode: "llm" as const,
    ...parsed,
    model,
  };
}
