import express from "express";
import cors from "cors";
import { corsOptions } from "./config/cors";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth.routes";
import keywordRuleRoutes from "./routes/keywordRule.routes";
import analyticsRoutes from "./routes/analytics.routes";
import webhookRoutes from "./routes/webhook.routes";
import instagramRoutes from "./routes/instagram.routes";
import billingRoutes from "./routes/billing.routes";
import { billingController } from "./controllers/billing.controller";

export function createApp() {
  const app = express();

  // Registered first so health checks succeed before any other middleware runs.
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "insta-autodm-api" });
  });

  app.use(cors(corsOptions));

  app.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    (req, res, next) => billingController.webhook(req, res, next),
  );

  app.use(express.json());

  app.use("/api/auth", authRoutes);
  app.use("/api/keyword-rules", keywordRuleRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/instagram", instagramRoutes);
  app.use("/api/billing", billingRoutes);

  app.use(errorHandler);

  return app;
}
