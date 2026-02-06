export type SplunkConnectRequest = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
};

export type SplunkConnectResponse = {
  ok: boolean;
  tools: string[];
  details?: unknown;
  error: {
    message: string;
    code?: string;
  } | null;
};

export type SplunkQueryRequest = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  spl: string;
  timeoutMs?: number;
};

export type SplunkQueryResponse = {
  ok: boolean;
  toolUsed: string | null;
  result?: unknown;
  error: {
    message: string;
    code?: string;
  } | null;
};

// Audit Types
export type AuditStartRequest = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  timeRange: string;
  scope?: string;
};

export type AuditStartResponse = {
  ok: boolean;
  auditId: string;
  status: "started";
  error: {
    message: string;
  } | null;
};

export type AuditStage = "coverage" | "selecting" | "running" | "packaging" | "report" | "complete" | "failed";

export type LogEntry = {
  message: string;
  level: "info" | "error";
};

export type AuditStatusResponse = {
  ok: boolean;
  auditId: string;
  stage: AuditStage;
  progress: number;
  logs: LogEntry[];
  error: {
    message: string;
  } | null;
};

export type FindingSeverity = "critical" | "high" | "medium" | "low";

export type Finding = {
  id: string;
  severity: FindingSeverity;
  title: string;
  affectedEntities: string[];
  evidenceCount: number;
  confidence: number;
  description: string;
  evidence: string[];
  queries: string[];
  recommendation: string;
};

export type AuditResultsResponse = {
  ok: boolean;
  auditId: string;
  findings: Finding[];
  stats: {
    riskLevel: "low" | "medium" | "high" | "critical";
    totalFindings: number;
    avgConfidence: number;
    evidenceCount: number;
  };
  summary: string;
  error: {
    message: string;
  } | null;
};
