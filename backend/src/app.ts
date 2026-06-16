import express from "express";
import cors from "cors";
import { corsOptions } from "./config/cors";
import { errorHandler } from "./middleware/errorHandler";
import { prisma } from "./lib/prisma";
import { getDatabaseHostHint, getEnvDiagnostics } from "./utils/dbDiagnostics";
import authRoutes from "./routes/auth.routes";
import keywordRuleRoutes from "./routes/keywordRule.routes";
import analyticsRoutes from "./routes/analytics.routes";
import webhookRoutes from "./routes/webhook.routes";
import instagramRoutes from "./routes/instagram.routes";
import integrationsRoutes from "./routes/integrations.routes";
import activityRoutes from "./routes/activity.routes";
import billingRoutes from "./routes/billing.routes";
import activationRoutes from "./routes/activation.routes";
import debugRoutes from "./routes/debug.routes";
import { billingController } from "./controllers/billing.controller";

export function createApp() {
  const app = express();

  // Registered first so health checks succeed before any other middleware runs.
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "insta-autodm-api" });
  });

  app.get("/health/db", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: "ok",
        database: "connected",
        databaseHost: getDatabaseHostHint(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Database unavailable";
      console.error("[health/db] database check failed:", {
        databaseHost: getDatabaseHostHint(),
        message,
      });
      res.status(503).json({
        status: "error",
        database: "unavailable",
        databaseHost: getDatabaseHostHint(),
        message,
        environment: getEnvDiagnostics(),
      });
    }
  });

  app.use(cors(corsOptions));

  app.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    (req, res, next) => billingController.webhook(req, res, next),
  );

  app.use(express.json({ limit: "1mb" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/keyword-rules", keywordRuleRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/instagram", instagramRoutes);
  app.use("/api/integrations", integrationsRoutes);
  app.use("/api/activity", activityRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api/activation", activationRoutes);
  app.use("/api/debug", debugRoutes);

  app.use(errorHandler);

  return app;
}
