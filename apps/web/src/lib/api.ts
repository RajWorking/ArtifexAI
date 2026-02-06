const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface AuditStartRequest {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  timeRange: string;
  scope?: string;
}

export interface AuditStartResponse {
  ok: boolean;
  auditId: string;
  status: "started";
  error: { message: string } | null;
}

export interface AuditStatusResponse {
  ok: boolean;
  auditId: string;
  stage: "coverage" | "selecting" | "running" | "packaging" | "report" | "complete";
  progress: number;
  logs: string[];
  error: { message: string } | null;
}

export interface Finding {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  affectedEntities: string[];
  evidenceCount: number;
  confidence: number;
  description: string;
  evidence: string[];
  queries: string[];
  recommendation: string;
}

export interface AuditResultsResponse {
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
  error: { message: string } | null;
}

export const api = {
  audit: {
    start: async (config: AuditStartRequest): Promise<AuditStartResponse> => {
      const response = await fetch(`${API_BASE_URL}/api/audit/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      return response.json();
    },

    status: async (auditId: string): Promise<AuditStatusResponse> => {
      const response = await fetch(`${API_BASE_URL}/api/audit/${auditId}/status`);
      return response.json();
    },

    results: async (auditId: string): Promise<AuditResultsResponse> => {
      const response = await fetch(`${API_BASE_URL}/api/audit/${auditId}/results`);
      return response.json();
    }
  }
};
