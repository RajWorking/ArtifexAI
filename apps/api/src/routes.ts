import { FastifyInstance } from "fastify";
import { z } from "zod";
import { SplunkClient } from "./siem/splunk.js";
import {
  AuditReportResponse,
  AuditRunResponse,
  AuditStatusResponse,
  SiemConnectResponse
} from "./types.js";
import { config } from "./config.js";

const siemConnectSchema = z.object({
  siemType: z.literal("splunk"),
  baseUrl: z.string().url(),
  token: z.string().min(1),
  verifySSL: z.boolean().default(true)
});

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { ok: true };
  });

  app.post("/api/siem/connect", async (request, reply) => {
    const parsed = siemConnectSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return {
        ok: false,
        siemType: "splunk",
        error: { message: "Invalid request body" }
      } satisfies SiemConnectResponse;
    }

    const { baseUrl, token, verifySSL } = parsed.data;

    try {
      const client = new SplunkClient({
        baseUrl,
        token,
        verifySSL,
        timeoutMs: config.requestTimeoutMs
      });

      const details = await client.checkConnection();

      return {
        ok: true,
        siemType: "splunk",
        details
      } satisfies SiemConnectResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const code = (err as { code?: string }).code;

      reply.status(502);
      return {
        ok: false,
        siemType: "splunk",
        error: {
          message,
          code
        }
      } satisfies SiemConnectResponse;
    }
  });

  // TODO: implement audit run (coverage + hunts)
  app.post("/api/audit/run", async () => {
    return {
      ok: true,
      auditId: "todo",
      status: "todo",
      message: "TODO: implement audit run"
    } satisfies AuditRunResponse;
  });

  // TODO: implement audit status lookup
  app.get("/api/audit/:id/status", async (request) => {
    const { id } = request.params as { id: string };
    return {
      ok: true,
      auditId: id,
      status: "todo",
      message: "TODO: implement audit status"
    } satisfies AuditStatusResponse;
  });

  // TODO: implement audit report generation
  app.get("/api/audit/:id/report", async (request) => {
    const { id } = request.params as { id: string };
    return {
      ok: true,
      auditId: id,
      status: "todo",
      message: "TODO: implement audit report"
    } satisfies AuditReportResponse;
  });
}
