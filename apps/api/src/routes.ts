import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createMcpClient } from "@artifexai/mcp";
import {
  SplunkConnectResponse,
  SplunkQueryResponse,
  AuditStartResponse,
  AuditStatusResponse,
  AuditResultsResponse,
  AuditStage
} from "./types.js";
import { config } from "./config.js";

// In-memory store for audit sessions
interface AuditSession {
  id: string;
  stage: AuditStage;
  progress: number;
  logs: string[];
  startedAt: number;
  config: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    timeRange: string;
    scope?: string;
  };
}

const auditSessions = new Map<string, AuditSession>();

const splunkConnectSchema = z.object({
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  timeoutMs: z.number().int().positive().optional()
});

const splunkQuerySchema = z.object({
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  spl: z.string().min(1),
  timeoutMs: z.number().int().positive().optional()
});

// Splunk MCP tool names per docs; keep generic fallbacks for other MCP servers.
const infoToolPreference = ["splunk_get_info", "get_info", "server_info", "info"] as const;
const queryToolPreference = [
  "splunk_run_query",
  "run_splunk_query",
  "run_query",
  "search",
  "splunk_search"
] as const;
// TODO: Tool input schemas vary by MCP server; extend this mapping as needed.
const queryArgStrategies = [
  (spl: string) => ({ query: spl }),
  (spl: string) => ({ spl }),
  (spl: string) => ({ search: spl })
];

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { ok: true };
  });

  app.post("/api/splunk/connect", async (request, reply) => {
    const parsed = splunkConnectSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return {
        ok: false,
        tools: [],
        details: undefined,
        error: { message: "Invalid request body" }
      } satisfies SplunkConnectResponse;
    }

    const resolvedCommand = parsed.data.command ?? config.splunkMcpCommand;
    if (!resolvedCommand) {
      reply.status(400);
      return {
        ok: false,
        tools: [],
        details: undefined,
        error: { message: "Missing MCP command. Provide command or set SPLUNK_MCP_COMMAND." }
      } satisfies SplunkConnectResponse;
    }

    const timeoutMs = parsed.data.timeoutMs ?? config.requestTimeoutMs;
    const env = buildSplunkEnv(parsed.data.env);

    let client: Awaited<ReturnType<typeof createMcpClient>> | null = null;

    try {
      client = await createMcpClient({
        name: "artifexai-api",
        version: "0.1.0",
        timeoutMs,
        transport: {
          type: "stdio",
          command: resolvedCommand,
          args: parsed.data.args,
          env
        }
      });

      const tools = await client.listTools();
      const toolNames = tools.map((tool) => tool.name);

      const infoTool = pickTool(toolNames, infoToolPreference);
      let details: unknown = undefined;
      let infoError: Error | undefined;

      if (infoTool) {
        try {
          details = await client.callTool(infoTool, {});
        } catch (err) {
          infoError = err as Error;
        }
      }

      if (infoError) {
        reply.status(502);
        return {
          ok: false,
          tools: toolNames,
          details: undefined,
          error: {
            message: `Tool ${infoTool ?? "info"} failed: ${infoError.message}`
          }
        } satisfies SplunkConnectResponse;
      }

      return {
        ok: true,
        tools: toolNames,
        details,
        error: null
      } satisfies SplunkConnectResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const code = (err as { code?: string }).code;

      reply.status(502);
      return {
        ok: false,
        tools: [],
        details: undefined,
        error: {
          message,
          code
        }
      } satisfies SplunkConnectResponse;
    } finally {
      if (client) {
        try {
          await client.close();
        } catch {
          // Ignore close errors to avoid masking primary failures.
        }
      }
    }
  });

  app.post("/api/splunk/query", async (request, reply) => {
    const parsed = splunkQuerySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return {
        ok: false,
        toolUsed: null,
        result: undefined,
        error: { message: "Invalid request body" }
      } satisfies SplunkQueryResponse;
    }

    const resolvedCommand = parsed.data.command ?? config.splunkMcpCommand;
    if (!resolvedCommand) {
      reply.status(400);
      return {
        ok: false,
        toolUsed: null,
        result: undefined,
        error: { message: "Missing MCP command. Provide command or set SPLUNK_MCP_COMMAND." }
      } satisfies SplunkQueryResponse;
    }

    const timeoutMs = parsed.data.timeoutMs ?? 20000;
    const env = buildSplunkEnv(parsed.data.env);

    let client: Awaited<ReturnType<typeof createMcpClient>> | null = null;

    try {
      client = await createMcpClient({
        name: "artifexai-api",
        version: "0.1.0",
        timeoutMs,
        transport: {
          type: "stdio",
          command: resolvedCommand,
          args: parsed.data.args,
          env
        }
      });

      const tools = await client.listTools();
      const toolNames = tools.map((tool) => tool.name);
      const queryTool = pickTool(toolNames, queryToolPreference);

      if (!queryTool) {
        reply.status(400);
        return {
          ok: false,
          toolUsed: null,
          result: undefined,
          error: { message: "No query tool found on MCP server." }
        } satisfies SplunkQueryResponse;
      }

      let lastError: Error | undefined;
      for (const buildArgs of queryArgStrategies) {
        try {
          const result = await client.callTool(queryTool, buildArgs(parsed.data.spl));
          return {
            ok: true,
            toolUsed: queryTool,
            result,
            error: null
          } satisfies SplunkQueryResponse;
        } catch (err) {
          lastError = err as Error;
        }
      }

      const message = lastError?.message ?? "Unknown error";
      reply.status(502);
      return {
        ok: false,
        toolUsed: queryTool,
        result: undefined,
        error: {
          message: `Tool ${queryTool} failed: ${message}`
        }
      } satisfies SplunkQueryResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const code = (err as { code?: string }).code;

      reply.status(502);
      return {
        ok: false,
        toolUsed: null,
        result: undefined,
        error: {
          message,
          code
        }
      } satisfies SplunkQueryResponse;
    } finally {
      if (client) {
        try {
          await client.close();
        } catch {
          // Ignore close errors to avoid masking primary failures.
        }
      }
    }
  });

  // Audit endpoints
  const auditStartSchema = z.object({
    command: z.string().min(1).optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    timeRange: z.string().min(1),
    scope: z.string().optional()
  });

  app.post("/api/audit/start", async (request, reply) => {
    const parsed = auditStartSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return {
        ok: false,
        auditId: "",
        status: "started" as const,
        error: { message: "Invalid request body" }
      } satisfies AuditStartResponse;
    }

    // Generate audit ID
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create audit session
    const session: AuditSession = {
      id: auditId,
      stage: "coverage",
      progress: 0,
      logs: [
        `[${new Date().toISOString()}] Audit session created`,
        `[${new Date().toISOString()}] Time range: ${parsed.data.timeRange} days`,
        parsed.data.scope ? `[${new Date().toISOString()}] Scope: ${parsed.data.scope}` : null
      ].filter(Boolean) as string[],
      startedAt: Date.now(),
      config: parsed.data
    };

    auditSessions.set(auditId, session);

    // Start background simulation of audit progress
    simulateAuditProgress(auditId);

    return {
      ok: true,
      auditId,
      status: "started" as const,
      error: null
    } satisfies AuditStartResponse;
  });

  app.get("/api/audit/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };

    const session = auditSessions.get(id);
    if (!session) {
      reply.status(404);
      return {
        ok: false,
        auditId: id,
        stage: "coverage" as const,
        progress: 0,
        logs: [],
        error: { message: "Audit session not found" }
      } satisfies AuditStatusResponse;
    }

    return {
      ok: true,
      auditId: id,
      stage: session.stage,
      progress: session.progress,
      logs: session.logs,
      error: null
    } satisfies AuditStatusResponse;
  });

  app.get("/api/audit/:id/results", async (request, reply) => {
    const { id } = request.params as { id: string };

    const session = auditSessions.get(id);
    if (!session) {
      reply.status(404);
      return {
        ok: false,
        auditId: id,
        findings: [],
        stats: {
          riskLevel: "low" as const,
          totalFindings: 0,
          avgConfidence: 0,
          evidenceCount: 0
        },
        summary: "",
        error: { message: "Audit session not found" }
      } satisfies AuditResultsResponse;
    }

    if (session.stage !== "complete") {
      reply.status(400);
      return {
        ok: false,
        auditId: id,
        findings: [],
        stats: {
          riskLevel: "low" as const,
          totalFindings: 0,
          avgConfidence: 0,
          evidenceCount: 0
        },
        summary: "",
        error: { message: "Audit still in progress" }
      } satisfies AuditResultsResponse;
    }

    // Return dummy findings that match frontend expectations
    return {
      ok: true,
      auditId: id,
      findings: generateDummyFindings(),
      stats: {
        riskLevel: "medium",
        totalFindings: 5,
        avgConfidence: 89,
        evidenceCount: 217
      },
      summary: "Your environment shows moderate security posture with 5 findings identified across privilege management, patch management, and access control domains. Immediate attention required for 2 high-severity findings related to privileged account usage and unpatched vulnerabilities.",
      error: null
    } satisfies AuditResultsResponse;
  });
}

// Simulate audit progress in background
function simulateAuditProgress(auditId: string): void {
  const stages: Array<{ stage: AuditStage; duration: number; progress: number }> = [
    { stage: "coverage", duration: 2000, progress: 15 },
    { stage: "selecting", duration: 3000, progress: 30 },
    { stage: "running", duration: 8000, progress: 70 },
    { stage: "packaging", duration: 2000, progress: 85 },
    { stage: "report", duration: 3000, progress: 95 },
    { stage: "complete", duration: 1000, progress: 100 }
  ];

  let currentStageIndex = 0;

  const processNextStage = () => {
    const session = auditSessions.get(auditId);
    if (!session || currentStageIndex >= stages.length) return;

    const stageInfo = stages[currentStageIndex];
    session.stage = stageInfo.stage;
    session.progress = stageInfo.progress;

    // Add stage-specific logs
    const stageLogs: Record<AuditStage, string[]> = {
      coverage: [
        "Connecting to Splunk instance...",
        "Connection established successfully",
        "Validating API credentials...",
        "Credentials validated - read-only access confirmed",
        "Starting coverage checks...",
        "Analyzing log sources coverage..."
      ],
      selecting: [
        "Selected 47 threat hunting queries",
        "Prioritizing queries by threat level...",
        "Query selection complete"
      ],
      running: [
        "Executing query: Privileged Account Usage",
        "Executing query: Lateral Movement Detection",
        "Executing query: Unpatched Systems Scan",
        "Executing query: Password Policy Compliance",
        "Executing query: Logging Coverage Analysis",
        "Query execution complete - 5 findings identified"
      ],
      packaging: [
        "Collecting evidence artifacts...",
        "Packaging evidence items...",
        "Evidence collection complete - 217 items"
      ],
      report: [
        "Generating executive summary...",
        "Compiling detailed findings...",
        "Generating recommendations...",
        "Report generation complete"
      ],
      complete: [
        "Audit complete - results ready for review"
      ]
    };

    const logsForStage = stageLogs[stageInfo.stage] || [];
    logsForStage.forEach(log => {
      session.logs.push(`[${new Date().toISOString()}] ${log}`);
    });

    currentStageIndex++;

    if (currentStageIndex < stages.length) {
      setTimeout(processNextStage, stageInfo.duration);
    }
  };

  // Start processing stages
  setTimeout(processNextStage, 500);
}

// Generate dummy findings matching frontend expectations
function generateDummyFindings() {
  return [
    {
      id: "F001",
      severity: "high" as const,
      title: "Unauthorized Privileged Account Usage",
      affectedEntities: ["DC-01", "DC-02", "FILE-SRV-01"],
      evidenceCount: 23,
      confidence: 92,
      description: "Detected privileged account usage outside of normal business hours from suspicious IP addresses. Multiple domain admin accounts showed activity between 2:00 AM and 4:00 AM originating from geographically anomalous locations.",
      evidence: [
        "2025-01-15 02:34:12 - Admin account 'DA_ADMIN' logged in from IP 185.220.101.42",
        "2025-01-15 02:35:48 - Lateral movement detected: DC-01 → FILE-SRV-01",
        "2025-01-15 02:37:23 - Sensitive file access: /shares/executive/financial_reports/",
        "2025-01-15 02:39:01 - Privileged group modification detected"
      ],
      queries: [
        "index=windows EventCode=4624 Account_Type=Admin | where hour >= 22 OR hour <= 6",
        "index=windows EventCode=4648 | stats count by Source_Host Destination_Host"
      ],
      recommendation: "Immediately reset credentials for affected privileged accounts. Implement privileged access management (PAM) solution. Enable MFA for all administrative accounts. Conduct forensic investigation of affected systems."
    },
    {
      id: "F002",
      severity: "high" as const,
      title: "Unpatched Critical Vulnerabilities",
      affectedEntities: ["WEB-SRV-03", "WEB-SRV-04", "WEB-SRV-05"],
      evidenceCount: 18,
      confidence: 95,
      description: "Multiple internet-facing web servers running outdated software with known critical CVEs. Systems are missing security patches released over 90 days ago.",
      evidence: [
        "WEB-SRV-03: Apache 2.4.49 (CVE-2021-41773 - Critical)",
        "WEB-SRV-04: Apache 2.4.49 (CVE-2021-41773 - Critical)",
        "WEB-SRV-05: OpenSSL 1.1.1k (CVE-2021-3711 - High)"
      ],
      queries: [
        "index=vulnerability severity=critical status=open age>90",
        "index=assets category=web_server | join host [search index=patches status=missing]"
      ],
      recommendation: "Emergency patch deployment required within 24 hours. Implement automated patch management. Add vulnerability scanning to CI/CD pipeline."
    },
    {
      id: "F003",
      severity: "medium" as const,
      title: "Weak Password Policy Implementation",
      affectedEntities: ["domain.local", "legacy-app.local"],
      evidenceCount: 156,
      confidence: 88,
      description: "Password policies do not meet industry standards. Detected accounts with passwords that haven't been changed in over 365 days and weak complexity requirements.",
      evidence: [
        "156 accounts with password age > 365 days",
        "Password minimum length: 8 characters (recommended: 14+)",
        "Password complexity: Not enforced on legacy domain",
        "Password history: 3 passwords (recommended: 24)"
      ],
      queries: [
        "index=ad EventCode=4724 | stats max(password_age) by user",
        "index=ad | eval weak_policy=if(min_length<14, \"true\", \"false\")"
      ],
      recommendation: "Update domain password policies to enforce 14+ character minimum, complexity requirements, and 24-password history. Implement regular password expiration for privileged accounts."
    },
    {
      id: "F004",
      severity: "medium" as const,
      title: "Insufficient Logging Coverage",
      affectedEntities: ["APP-SRV-01", "APP-SRV-02", "DB-SRV-01"],
      evidenceCount: 8,
      confidence: 91,
      description: "Critical servers missing comprehensive audit logging. Application and database servers not forwarding logs to SIEM, creating blind spots in security monitoring.",
      evidence: [
        "APP-SRV-01: No logs received in past 7 days",
        "APP-SRV-02: Partial logging - only errors captured",
        "DB-SRV-01: Database audit logs not enabled"
      ],
      queries: [
        "index=* | stats count by host | where count=0",
        "index=inventory category=critical | join host [search index=logging status=inactive]"
      ],
      recommendation: "Deploy logging agents to all critical servers. Enable database audit logging. Implement log retention policy of minimum 90 days. Configure SIEM alerting for logging failures."
    },
    {
      id: "F005",
      severity: "low" as const,
      title: "Excessive Service Account Permissions",
      affectedEntities: ["SVC_BACKUP", "SVC_MONITORING", "SVC_APP1"],
      evidenceCount: 12,
      confidence: 85,
      description: "Service accounts have been granted excessive privileges beyond their operational requirements. Following principle of least privilege, these accounts should have permissions reduced.",
      evidence: [
        "SVC_BACKUP: Member of Domain Admins (unnecessary)",
        "SVC_MONITORING: Full control on C:\\ drive",
        "SVC_APP1: Local administrator on 45 servers"
      ],
      queries: [
        "index=ad objectClass=serviceAccount | stats list(memberOf) by sAMAccountName",
        "index=windows EventCode=4672 | search Account_Name=SVC_*"
      ],
      recommendation: "Review and reduce service account permissions to minimum required. Implement service account management policy. Use group managed service accounts (gMSA) where possible."
    }
  ];
}

function pickTool(toolNames: string[], preference: readonly string[]): string | null {
  for (const name of preference) {
    if (toolNames.includes(name)) return name;
  }
  return null;
}

function buildSplunkEnv(overrides?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  if (config.splunkHost) env.SPLUNK_HOST = config.splunkHost;
  if (config.splunkToken) env.SPLUNK_TOKEN = config.splunkToken;
  if (typeof config.splunkVerifySSL === "boolean") {
    env.SPLUNK_VERIFY_SSL = String(config.splunkVerifySSL);
  }

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === "string") {
        env[key] = value;
      }
    }
  }

  return env;
}
