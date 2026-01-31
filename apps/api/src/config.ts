export const config = {
  port: Number(process.env.API_PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 5000)
};
