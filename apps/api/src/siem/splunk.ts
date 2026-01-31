import { Agent } from "undici";

export type SplunkConnectionDetails = {
  serverName?: string;
  version?: string;
};

export class SplunkClient {
  private baseUrl: string;
  private token: string;
  private verifySSL: boolean;
  private timeoutMs: number;

  constructor(opts: { baseUrl: string; token: string; verifySSL: boolean; timeoutMs: number }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
    this.verifySSL = opts.verifySSL;
    this.timeoutMs = opts.timeoutMs;
  }

  async checkConnection(): Promise<SplunkConnectionDetails> {
    const endpoints = [
      "/services/server/info",
      "/services/authentication/current-context"
    ];

    const authHeaders = [
      { header: "Authorization", value: `Bearer ${this.token}` },
      { header: "Authorization", value: `Splunk ${this.token}` }
    ];

    const dispatcher = this.verifySSL
      ? undefined
      : new Agent({ connect: { rejectUnauthorized: false } });

    let lastError: Error | undefined;

    for (const endpoint of endpoints) {
      for (const auth of authHeaders) {
        try {
          const url = new URL(`${this.baseUrl}${endpoint}`);
          url.searchParams.set("output_mode", "json");

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

          const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
              Accept: "application/json",
              [auth.header]: auth.value
            },
            dispatcher,
            signal: controller.signal
          });

          clearTimeout(timeout);

          if (!res.ok) {
            const err = new Error(`Splunk responded with ${res.status}`);
            (err as Error & { code?: string }).code = String(res.status);
            throw err;
          }

          const data = await res.json();
          const details = extractDetails(data);
          return details;
        } catch (err) {
          lastError = err as Error;
        }
      }
    }

    throw lastError ?? new Error("Unable to connect to Splunk");
  }
}

function extractDetails(data: unknown): SplunkConnectionDetails {
  if (!data || typeof data !== "object") return {};

  const entry = (data as { entry?: Array<{ content?: Record<string, unknown> }> }).entry?.[0];
  const content = entry?.content ?? {};

  const serverName = typeof content.serverName === "string" ? content.serverName : undefined;
  const version = typeof content.version === "string" ? content.version : undefined;

  return { serverName, version };
}
