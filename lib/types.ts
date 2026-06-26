export type NodeStatus = 'pending' | 'running' | 'success' | 'failed' | 'blocked' | 'waiting'
export type GateVerdict = 'PASS' | 'WARN' | 'FAIL'
export type NodeType = 'build' | 'test' | 'security' | 'approval' | 'migration' | 'staging' | 'canary' | 'production'

export interface WorkflowNode {
  id: string
  type: NodeType
  label: string
  status: NodeStatus
  startedAt?: Date
  completedAt?: Date
  duration?: number
  error?: string
  dependencies: string[]
}

export interface ReleaseRun {
  id: string
  projectId: string
  projectName: string
  branchName: string
  commitHash: string
  commitMessage: string
  environment: 'staging' | 'canary' | 'production'
  verdict: GateVerdict
  startedAt: Date
  updatedAt: Date
  nodes: WorkflowNode[]
  policyId?: string
  failedChecks: string[]
  blockedChecks: string[]
  waitingChecks: string[]
}

export interface TimelineEvent {
  id: string
  timestamp: Date
  type: 'node_started' | 'node_completed' | 'node_failed' | 'gate_evaluated' | 'policy_applied'
  nodeId?: string
  nodeName?: string
  message: string
  severity: 'info' | 'warning' | 'error'
}

export interface ReleasePolicyRule {
  id: string
  name: string
  requireNodeTypes: NodeType[]
  failOn: NodeStatus[]
  environment: 'staging' | 'canary' | 'production'
  enabled: boolean
}

export interface ReleaseMetadata {
  blastRadius: 'low' | 'medium' | 'high' | 'critical'
  criticalPath: string[]
  estimatedImpactedUsers?: number
}
