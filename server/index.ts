import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { initCollaborationServer } from "./services/realtime/collaboration-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = createApp();

  if (env.NODE_ENV === "production") {
    const staticPath = path.resolve(__dirname, "public");
    app.use(express.static(staticPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
        return next();
      }
      return res.sendFile(path.join(staticPath, "index.html"));
    });
  }

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
