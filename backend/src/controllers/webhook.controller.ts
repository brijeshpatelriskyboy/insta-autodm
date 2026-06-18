import type { Request, Response, NextFunction } from "express";
import { getMetaVerifyToken } from "../config/meta";
import { instagramWebhookService } from "../services/instagramWebhook.service";

export class WebhookController {
  verify(req: Request, res: Response): void {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const verifyToken = getMetaVerifyToken();

    if (mode === "subscribe" && token === verifyToken && challenge) {
      console.log("[webhook] Meta verification succeeded");
      res.status(200).send(challenge);
      return;
    }

    console.warn("[webhook] Meta verification failed:", {
      mode: mode ?? null,
      tokenMatch: token === verifyToken,
      hasChallenge: Boolean(challenge),
    });
    res.sendStatus(403);
  }

  async handleEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await instagramWebhookService.processWebhookPayload(req.body);

      res.status(200).json({
        received: true,
        ...result,
      });
    } catch (error) {
      console.error("[webhook] event processing failed:", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
}

export const webhookController = new WebhookController();
