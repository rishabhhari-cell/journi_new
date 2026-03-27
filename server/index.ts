import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { initCollaborationServer } from "./services/realtime/collaboration-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = createApp();

  const server = createServer(app);
  initCollaborationServer(server);

  server.listen(env.PORT, () => {
    logger.info("Server listening", {
      port: env.PORT,
      appBaseUrl: env.APP_BASE_URL,
      environment: env.NODE_ENV,
    });
  });
}

startServer().catch((error) => {
  logger.error("Fatal server bootstrap failure", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
