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
import { loadHunts, loadHunt, getHuntSummary } from "./huntLoader.js";
import { executeHunt, type HuntExecutorConfig } from "./huntExecutor.js";

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
  findings: Finding[];
}

const auditSessions = new Map<string, AuditSession>();
import type { Finding } from "./types.js";

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
const infoToolPreference = ["get_splunk_info", "splunk_get_info", "get_info", "server_info", "info"] as const;
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

  // Hunt management endpoints
  app.get("/api/hunts", async () => {
    try {
      const hunts = await loadHunts();
      return {
        ok: true,
        hunts: hunts.map(h => getHuntSummary(h))
      };
    } catch (err) {
      return {
        ok: false,
        error: { message: err instanceof Error ? err.message : "Failed to load hunts" }
      };
    }
  });

  app.get("/api/hunts/:id", async (request) => {
    try {
      const { id } = request.params as { id: string };
      const hunt = await loadHunt(id);

      if (!hunt) {
        return {
          ok: false,
          error: { message: "Hunt not found" }
        };
      }

      return {
        ok: true,
        hunt: {
          ...getHuntSummary(hunt),
          content: hunt.content
        }
      };
    } catch (err) {
      return {
        ok: false,
        error: { message: err instanceof Error ? err.message : "Failed to load hunt" }
      };
    }
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
          args: parsed.data.args ?? config.splunkMcpArgs,
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
          args: parsed.data.args ?? config.splunkMcpArgs,
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
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

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
      config: parsed.data,
      findings: []
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

    // Return real findings from hunt execution
    const findings = session.findings;
    const evidenceCount = findings.reduce((sum, f) => sum + f.evidenceCount, 0);
    const avgConfidence = findings.length > 0
      ? Math.round(findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length)
      : 0;

    // Calculate risk level based on severity distribution
    const criticalCount = findings.filter(f => f.severity === "critical").length;
    const highCount = findings.filter(f => f.severity === "high").length;
    const riskLevel: "low" | "medium" | "high" | "critical" =
      criticalCount > 0 ? "critical" :
      highCount >= 2 ? "high" :
      highCount >= 1 ? "medium" : "low";

    // Generate summary
    const summary = findings.length > 0
      ? `Automated threat hunting identified ${findings.length} finding${findings.length > 1 ? 's' : ''} requiring attention. ` +
        (highCount > 0 || criticalCount > 0 ? `${highCount + criticalCount} high-priority issue${highCount + criticalCount > 1 ? 's' : ''} detected. ` : '') +
        `Review detailed findings and recommendations below.`
      : `No significant security threats detected during automated threat hunting. Continue monitoring and periodic assessments.`;

    return {
      ok: true,
      auditId: id,
      findings,
      stats: {
        riskLevel,
        totalFindings: findings.length,
        avgConfidence,
        evidenceCount
      },
      summary,
      error: null
    } satisfies AuditResultsResponse;
  });
}

// Simulate audit progress in background
function simulateAuditProgress(auditId: string): void {
  const stages: Array<{ stage: AuditStage; duration: number; progress: number }> = [
    { stage: "coverage", duration: 2000, progress: 15 },
    { stage: "selecting", duration: 3000, progress: 30 },
    { stage: "running", duration: 0, progress: 70 }, // Duration will be dynamic based on hunt execution
    { stage: "packaging", duration: 2000, progress: 85 },
    { stage: "report", duration: 3000, progress: 95 },
    { stage: "complete", duration: 1000, progress: 100 }
  ];

  let currentStageIndex = 0;

  const processNextStage = async () => {
    const session = auditSessions.get(auditId);
    if (!session || currentStageIndex >= stages.length) return;

    const stageInfo = stages[currentStageIndex];
    session.stage = stageInfo.stage;
    session.progress = stageInfo.progress;

    // Add stage-specific logs
    if (stageInfo.stage === "coverage") {
      const mcpCommand = session.config.command || config.splunkMcpCommand || "npx";
      const mcpArgs = session.config.args || config.splunkMcpArgs || [];
      const mcpEnv = session.config.env || buildSplunkEnv();

      let client: Awaited<ReturnType<typeof createMcpClient>> | null = null;
      try {
        session.logs.push(`[${new Date().toISOString()}] Connecting to Splunk instance...`);
        client = await createMcpClient({
          name: "artifexai-coverage",
          version: "0.1.0",
          timeoutMs: config.requestTimeoutMs,
          transport: { type: "stdio", command: mcpCommand, args: mcpArgs, env: mcpEnv }
        });
        session.logs.push(`[${new Date().toISOString()}] Connection established successfully`);

        const tools = await client.listTools();
        const toolNames = tools.map(t => t.name);
        session.logs.push(`[${new Date().toISOString()}] Discovered ${toolNames.length} MCP tools: ${toolNames.join(", ")}`);

        // Validate credentials via get_splunk_info
        session.logs.push(`[${new Date().toISOString()}] Validating API credentials...`);
        const infoTool = pickTool(toolNames, infoToolPreference);
        if (infoTool) {
          const info = await client.callTool(infoTool, {}) as any;
          const infoText = info?.content?.[0]?.text ?? JSON.stringify(info);
          session.logs.push(`[${new Date().toISOString()}] Credentials validated - ${infoTool} responded`);
          (session as any).splunkInfo = infoText;
        } else {
          session.logs.push(`[${new Date().toISOString()}] No info tool found - skipping credential validation`);
        }

        // Check log source coverage via get_indexes
        session.logs.push(`[${new Date().toISOString()}] Analyzing log sources coverage...`);
        const indexTool = pickTool(toolNames, ["get_indexes"] as unknown as readonly string[]);
        if (indexTool) {
          const indexes = await client.callTool(indexTool, {}) as any;
          const indexText = indexes?.content?.[0]?.text ?? JSON.stringify(indexes);
          try {
            const parsed = JSON.parse(indexText);
            // Handle both { results: [...] } and direct array formats
            const items = parsed?.results ?? (Array.isArray(parsed) ? parsed : null);
            if (Array.isArray(items)) {
              const indexNames = items.map((i: any) => i.name || i.title || i);
              session.logs.push(`[${new Date().toISOString()}] Found ${indexNames.length} indexes: ${indexNames.slice(0, 10).join(", ")}${indexNames.length > 10 ? "..." : ""}`);
            } else {
              session.logs.push(`[${new Date().toISOString()}] Indexes retrieved successfully`);
            }
          } catch {
            session.logs.push(`[${new Date().toISOString()}] Indexes retrieved successfully`);
          }
        } else {
          session.logs.push(`[${new Date().toISOString()}] No index tool found - skipping coverage analysis`);
        }

        session.logs.push(`[${new Date().toISOString()}] Coverage check complete`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        session.logs.push(`[${new Date().toISOString()}] Coverage check failed: ${msg}`);
      } finally {
        if (client) {
          try { await client.close(); } catch { /* ignore */ }
        }
      }
    } else if (stageInfo.stage === "selecting") {
      try {
        // Load all available hunts
        const hunts = await loadHunts();
        session.logs.push(`[${new Date().toISOString()}] Loaded ${hunts.length} threat hunting playbooks`);
        session.logs.push(`[${new Date().toISOString()}] Prioritizing hunts by threat level...`);
        session.logs.push(`[${new Date().toISOString()}] Hunt selection complete`);

        // Store hunts in session for running stage
        (session as any).hunts = hunts;
      } catch (err) {
        session.logs.push(`[${new Date().toISOString()}] Error loading hunts: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    } else if (stageInfo.stage === "running") {
      // Execute hunts using LLM
      const hunts = (session as any).hunts || [];

      if (hunts.length === 0) {
        session.logs.push(`[${new Date().toISOString()}] No hunts available to execute`);
      } else {
        session.logs.push(`[${new Date().toISOString()}] Starting LLM-guided threat hunting...`);

        // Prepare executor config from session config
        const executorConfig: HuntExecutorConfig = {
          mcpCommand: session.config.command || config.splunkMcpCommand || "npx",
          mcpArgs: session.config.args || config.splunkMcpArgs || [],
          mcpEnv: session.config.env || buildSplunkEnv(),
          timeRange: session.config.timeRange
        };

        // Execute each hunt
        for (const hunt of hunts) {
          try {
            session.logs.push(`[${new Date().toISOString()}] Executing hunt: ${hunt.id}`);

            const findings = await executeHunt(hunt, executorConfig);

            if (findings.length > 0) {
              session.findings.push(...findings);
              session.logs.push(`[${new Date().toISOString()}] Hunt ${hunt.id} completed - ${findings.length} finding(s) identified`);
            } else {
              session.logs.push(`[${new Date().toISOString()}] Hunt ${hunt.id} completed - no suspicious activity detected`);
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            session.logs.push(`[${new Date().toISOString()}] Hunt ${hunt.id} failed: ${errorMsg}`);
          }
        }

        session.logs.push(`[${new Date().toISOString()}] All hunts completed - ${session.findings.length} total finding(s)`);
      }
    } else if (stageInfo.stage === "packaging") {
      const evidenceCount = session.findings.reduce((sum, f) => sum + f.evidenceCount, 0);
      session.logs.push(`[${new Date().toISOString()}] Collecting evidence artifacts...`);
      session.logs.push(`[${new Date().toISOString()}] Packaging evidence items...`);
      session.logs.push(`[${new Date().toISOString()}] Evidence collection complete - ${evidenceCount} items`);
    } else if (stageInfo.stage === "report") {
      session.logs.push(`[${new Date().toISOString()}] Generating executive summary...`);
      session.logs.push(`[${new Date().toISOString()}] Compiling detailed findings...`);
      session.logs.push(`[${new Date().toISOString()}] Generating recommendations...`);
      session.logs.push(`[${new Date().toISOString()}] Report generation complete`);
    } else if (stageInfo.stage === "complete") {
      session.logs.push(`[${new Date().toISOString()}] Audit complete - results ready for review`);
    }

    currentStageIndex++;

    if (currentStageIndex < stages.length) {
      setTimeout(() => processNextStage(), stageInfo.duration);
    }
  };

  // Start processing stages
  setTimeout(() => processNextStage(), 500);
}

// Generate dummy findings matching frontend expectations
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
