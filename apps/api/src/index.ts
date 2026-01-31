import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes.js";
import { config } from "./config.js";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: config.corsOrigin
});

await registerRoutes(app);

app.listen({ port: config.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
