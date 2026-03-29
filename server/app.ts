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

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => callback(null, true),
      credentials: true,
    }),
  );
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
