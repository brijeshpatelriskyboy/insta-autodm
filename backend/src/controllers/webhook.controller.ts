import type { Request, Response, NextFunction } from "express";

/**
 * Placeholder for Meta Instagram webhook integration.
 * Future implementation will verify signatures and process comment events.
 */
export class WebhookController {
  verify(req: Request, res: Response): void {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const verifyToken = process.env.META_VERIFY_TOKEN ?? "insta-autodm-verify-token";

    if (mode === "subscribe" && token === verifyToken && challenge) {
      res.status(200).send(challenge);
      return;
    }

    res.sendStatus(403);
  }

  handleEvent(req: Request, res: Response, next: NextFunction): void {
    try {
      // Placeholder: acknowledge webhook receipt
      console.log("[Webhook] Received Meta Instagram event:", JSON.stringify(req.body));

      res.status(200).json({
        received: true,
        message: "Webhook placeholder — Meta integration coming in a future phase",
      });
    } catch (error) {
      next(error);
    }
  }
}

export const webhookController = new WebhookController();
