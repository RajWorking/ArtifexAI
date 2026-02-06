import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createMcpClient } from "@artifexai/mcp";
import {
  SplunkConnectResponse,
  SplunkQueryResponse
} from "./types.js";
import { config } from "./config.js";

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
