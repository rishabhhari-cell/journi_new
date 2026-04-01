import cors from "cors";
import express from "express";
import path from "node:path";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth";
import { organizationsRouter } from "./routes/organizations";
import { journalsRouter } from "./routes/journals";
import { projectsRouter } from "./routes/projects";
import { manuscriptsRouter } from "./routes/manuscripts";
import { commentsRouter } from "./routes/comments";
import { citationsRouter } from "./routes/citations";
import { billingRouter, billingWebhookHandler } from "./routes/billing";
import { submissionsRouter } from "./routes/submissions";

function buildAllowedOrigins() {
  const defaults = [env.CLIENT_BASE_URL];
  const extras = (env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...defaults, ...extras]);
}

export function createApp() {
  const app = express();
  const allowedOrigins = buildAllowedOrigins();

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow server-to-server requests (no Origin header).
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        // Reject with an error so the browser receives a proper CORS failure
        // rather than a silent non-match — important when credentials are enabled.
        return callback(new Error(`CORS: origin '${origin}' is not permitted`));
      },
      credentials: true,
      // Explicitly enumerate the headers the client is allowed to send/read.
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: [],
    }),
  );
  app.post("/api/billing/webhook", express.raw({ type: "application/json" }), billingWebhookHandler);
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      now: new Date().toISOString(),
    });
  });

  app.get("/api/me", (_req, res) => {
    res.redirect(307, "/api/auth/me");
  });

  app.use("/api/auth", authRouter);
  app.use("/api/organizations", organizationsRouter);
  app.use("/api/journals", journalsRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/manuscripts", manuscriptsRouter);
  app.use("/api/comments", commentsRouter);
  app.use("/api/citations", citationsRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/submissions", submissionsRouter);

  app.use("/api/*", notFoundHandler);

  // Serve built React frontend in production
  if (env.NODE_ENV === "production") {
    const publicPath = path.join(process.cwd(), "dist", "public");
    app.use(express.static(publicPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(publicPath, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
