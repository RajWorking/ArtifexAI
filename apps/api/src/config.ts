import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
  mockMode: normalizeBoolean(process.env.MOCK_MODE) ?? false,
  port: Number(process.env.API_PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 10000),
  splunkMcpCommand: process.env.SPLUNK_MCP_COMMAND,
  splunkHost: process.env.SPLUNK_HOST,
  splunkToken: process.env.SPLUNK_TOKEN,
  splunkVerifySSL: normalizeBoolean(process.env.SPLUNK_VERIFY_SSL),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  get splunkMcpArgs(): string[] | undefined {
    if (!this.splunkHost || !this.splunkToken) return undefined;
    return [
      "-y", "mcp-remote",
      `${this.splunkHost}/services/mcp`,
      "--header",
      `Authorization: Bearer ${this.splunkToken}`
    ];
  }
};

function normalizeBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return undefined;
}
