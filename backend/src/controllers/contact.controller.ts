import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { CONTACT_LIMITS, containsHeaderInjection } from "../config/contact";
import { contactService } from "../services/contact.service";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(CONTACT_LIMITS.name),
  email: z.string().trim().email().max(CONTACT_LIMITS.email),
  subject: z.string().trim().min(1).max(CONTACT_LIMITS.subject),
  message: z.string().trim().min(1).max(CONTACT_LIMITS.message),
});

export class ContactController {
  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = contactSchema.parse(req.body);
      if (
        containsHeaderInjection(body.name) ||
        containsHeaderInjection(body.email) ||
        containsHeaderInjection(body.subject)
      ) {
        res.status(400).json({ error: "Invalid input" });
        return;
      }
      const result = await contactService.submit(body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const contactController = new ContactController();
