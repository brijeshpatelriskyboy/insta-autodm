import express from "express";
import cors from "cors";
import { corsOptions } from "./config/cors";
import { errorHandler } from "./middleware/errorHandler";
import { metaWebhookSignatureMiddleware } from "./middleware/metaWebhookSignature";
import authRoutes from "./routes/auth.routes";
import keywordRuleRoutes from "./routes/keywordRule.routes";
import analyticsRoutes from "./routes/analytics.routes";
import webhookRoutes from "./routes/webhook.routes";
import instagramRoutes from "./routes/instagram.routes";
import integrationsRoutes from "./routes/integrations.routes";
import metaRoutes from "./routes/meta.routes";
import activityRoutes from "./routes/activity.routes";
import billingRoutes from "./routes/billing.routes";
import featuresRoutes from "./routes/features.routes";
import campaignRoutes from "./routes/campaign.routes";
import { createStagingRoutes } from "./routes/staging.routes";
import { billingController } from "./controllers/billing.controller";
import { webhookController } from "./controllers/webhook.controller";

export function createApp() {
  const app = express();

  // Registered first so health checks succeed before any other middleware runs.
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "insta-autodm-api",
      deploymentEnv: process.env.COMMENT2DM_DEPLOYMENT_ENV ?? null,
    });
  });

  app.use(cors(corsOptions));

  app.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    (req, res, next) => billingController.webhook(req, res, next),
  );

  // Instagram webhook POST needs the exact raw body for X-Hub-Signature-256.
  // Registered before express.json() so parsing cannot alter the bytes used for HMAC.
  app.post(
    "/api/webhooks/instagram",
    express.raw({ type: "application/json" }),
    metaWebhookSignatureMiddleware,
    (req, res, next) => void webhookController.handleEvent(req, res, next),
  );

  app.use(express.json());

  // Public Instagram OAuth callback — no auth; must stay registered in all envs.
  // Final production path: GET /api/meta/callback
  app.use("/api/meta", metaRoutes);

  app.use("/api/auth", authRoutes);
  app.use("/api/keyword-rules", keywordRuleRoutes);
  app.use("/api/analytics", analyticsRoutes);
  // GET /api/webhooks/instagram verification challenge only (POST handled above).
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/instagram", instagramRoutes);
  app.use("/api/integrations", integrationsRoutes);
  app.use("/api/activity", activityRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api/features", featuresRoutes);
  // Smart Campaigns CRUD — gated by authenticate + requireSmartCampaignsEnabled.
  app.use("/api/campaigns", campaignRoutes);

  // Staging-only Meta stub diagnostics — mounted only when stub is safely enabled.
  const stagingRoutes = createStagingRoutes();
  if (stagingRoutes) {
    app.use("/api/staging/meta-stub", stagingRoutes);
    console.log("[startup] staging Meta private-reply stub routes enabled");
  }

  app.use(errorHandler);

  return app;
}
