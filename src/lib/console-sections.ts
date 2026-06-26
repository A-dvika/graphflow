import {
  BarChart3,
  CheckSquare,
  FileText,
  GitBranch,
  LayoutDashboard,
  Server,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type ConsoleSection =
  | "overview"
  | "releases"
  | "deployments"
  | "quality-gates"
  | "analytics"
  | "logs"
  | "settings"
  | "documentation";

export type ConsoleSectionMeta = {
  id: ConsoleSection;
  label: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
};

export const primaryConsoleSections: ConsoleSectionMeta[] = [
  {
    id: "overview",
    label: "Overview",
    title: "Release Command Center",
    subtitle: "Live release graph, quality gate verdict, and agentic release intelligence.",
    icon: LayoutDashboard,
  },
  {
    id: "releases",
    label: "Releases",
    title: "Release Runs",
    subtitle: "Track active and recent release executions across the project.",
    icon: GitBranch,
  },
  {
    id: "deployments",
    label: "Deployments",
    title: "Deployment Control",
    subtitle: "Inspect deployment paths, blocked environments, and production readiness.",
    icon: Server,
  },
  {
    id: "quality-gates",
    label: "Quality Gates",
    title: "Quality Gate Evidence",
    subtitle: "Review deterministic policy decisions before production deployment.",
    icon: CheckSquare,
  },
  {
    id: "analytics",
    label: "Analytics",
    title: "Release Intelligence",
    subtitle: "Measure critical path, bottlenecks, gate outcomes, and release flow health.",
    icon: BarChart3,
  },
  {
    id: "logs",
    label: "Logs",
    title: "Audit Logs",
    subtitle: "Read the event trail behind every release decision and run transition.",
    icon: FileText,
  },
];

export const secondaryConsoleSections: ConsoleSectionMeta[] = [
  {
    id: "settings",
    label: "Settings",
    title: "System Settings",
    subtitle: "Validate backend connectivity, storage sources, and agent runtime state.",
    icon: Settings,
  },
  {
    id: "documentation",
    label: "Documentation",
    title: "Developer Documentation",
    subtitle: "Use the APIs and GitLab integration pattern that turn pipelines into GraphFlow input.",
    icon: FileText,
  },
];

export const allConsoleSections = [...primaryConsoleSections, ...secondaryConsoleSections];

export function getConsoleSectionMeta(section: ConsoleSection) {
  return allConsoleSections.find((item) => item.id === section) ?? allConsoleSections[0];
}
