import crypto from "crypto";
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
import jarvisRoutes from "./routes/jarvis.routes";
import contactRoutes from "./routes/contact.routes";
import { billingController } from "./controllers/billing.controller";
import { webhookController } from "./controllers/webhook.controller";
import { sendEmail } from "./email/emailService";

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

  // Instagram webhook POST needs the exact raw body for X-Hub-Signature-256.
  // Registered before express.json() so parsing cannot alter the bytes used for HMAC.
  app.post(
    "/api/webhooks/instagram",
    express.raw({ type: "application/json" }),
    metaWebhookSignatureMiddleware,
    (req, res, next) => void webhookController.handleEvent(req, res, next),
  );

  app.use(express.json());

  // Internal SHC notification relay. This lets the SHC backend reuse the existing
  // verified Comment2DM/Resend delivery channel without exposing email credentials.
  app.post("/api/internal/shc-notify", async (req, res, next) => {
    try {
      const expected = process.env.SHC_NOTIFICATION_TOKEN || "";
      const provided = String(req.header("x-shc-notification-token") || "");
      if (!expected || !provided) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const a = Buffer.from(expected);
      const b = Buffer.from(provided);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const to = String(process.env.SHC_NOTIFICATION_EMAIL || "").trim();
      const subject = String(req.body?.subject || "").trim().slice(0, 180);
      const text = String(req.body?.text || "").trim().slice(0, 12000);
      const html = String(req.body?.html || "").trim().slice(0, 30000);
      if (!to || !to.includes("@") || !subject || (!text && !html)) {
        res.status(400).json({ error: "Invalid SHC notification" });
        return;
      }

      await sendEmail({
        kind: "security_notification",
        to,
        subject,
        text: text || "SHC notification",
        html: html || `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${text.replace(/[&<>]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c] as string))}</pre>`,
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // Public Instagram OAuth callback — no auth; must stay registered in all envs.
  // Final production path: GET /api/meta/callback
  app.use("/api/meta", metaRoutes);

  app.use("/api/auth", authRoutes);
  app.use("/api/contact", contactRoutes);
  app.use("/api/keyword-rules", keywordRuleRoutes);
  app.use("/api/analytics", analyticsRoutes);
  // GET /api/webhooks/instagram verification challenge only (POST handled above).
  app.use("/api/webhooks", webhookRoutes);
  app.use("/api/instagram", instagramRoutes);
  app.use("/api/integrations", integrationsRoutes);
  app.use("/api/activity", activityRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api/jarvis", jarvisRoutes);

  app.use(errorHandler);

  return app;
}
