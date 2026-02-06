import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  type StdioServerParameters
} from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
  type Tool
} from "@modelcontextprotocol/sdk/types.js";

export type McpTransportConfig = StdioServerParameters & {
  type: "stdio";
};

export type McpClientConfig = {
  name?: string;
  version?: string;
  timeoutMs?: number;
  transport: McpTransportConfig;
};

export type McpClient = {
  listTools: () => Promise<Tool[]>;
  callTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  close: () => Promise<void>;
};

const defaultClientInfo = {
  name: "artifexai-mcp-client",
  version: "0.1.0"
};

export async function createMcpClient(config: McpClientConfig): Promise<McpClient> {
  const client = new Client(
    {
      name: config.name ?? defaultClientInfo.name,
      version: config.version ?? defaultClientInfo.version
    },
    {
      capabilities: {}
    }
  );

  const { type: _type, ...stdioConfig } = config.transport;
  const transport = new StdioClientTransport(stdioConfig);

  await withTimeout(client.connect(transport), config.timeoutMs, "MCP connect timed out");

  return {
    listTools: async () => {
      const response = await withTimeout(
        client.request({ method: "tools/list" }, ListToolsResultSchema),
        config.timeoutMs,
        "MCP tools/list timed out"
      );
      return response.tools;
    },
    callTool: async (name: string, args?: Record<string, unknown>) => {
      const response = await withTimeout(
        client.request(
          {
            method: "tools/call",
            params: {
              name,
              arguments: args ?? {}
            }
          },
          CallToolResultSchema
        ),
        config.timeoutMs,
        "MCP tools/call timed out"
      );
      return response;
    },
    close: async () => {
      await transport.close();
    }
  };
}

export function formatToolDiscovery(tools: Tool[]): string {
  return tools
    .map((tool) => {
      const header = tool.description ? `${tool.name} - ${tool.description}` : tool.name;
      const schema = tool.inputSchema ? safeStringify(tool.inputSchema) : null;
      if (!schema) return header;
      return `${header}\n${schema}`;
    })
    .join("\n\n");
}

export function printToolDiscovery(
  tools: Tool[],
  logger: { log: (message: string) => void } = console
): void {
  logger.log(formatToolDiscovery(tools));
}

function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs?: number, message = "Request timed out") {
  if (!timeoutMs) return promise;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
