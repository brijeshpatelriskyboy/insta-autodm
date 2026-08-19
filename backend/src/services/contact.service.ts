import {
  isContactDeliveryConfigured,
  isSupportEmailConfigured,
  readEmailRuntimeConfig,
} from "../config/email";
import { containsHeaderInjection, stripHeaderInjection } from "../config/contact";
import {
  logSupportContactEmailOutcome,
  sendSupportContactEmail,
} from "../email/emailService";
import { EmailDeliveryError } from "../email/types";
import { AppError } from "../utils/errors";

export const CONTACT_UNAVAILABLE_MESSAGE =
  "Unable to send your message. Try again later.";

export interface ContactMessageInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export class ContactService {
  async submit(
    input: ContactMessageInput,
    processEnv: NodeJS.ProcessEnv = process.env,
  ): Promise<{ sent: true }> {
    if (
      containsHeaderInjection(input.name) ||
      containsHeaderInjection(input.email) ||
      containsHeaderInjection(input.subject)
    ) {
      throw new AppError(400, "Invalid input");
    }

    if (!isSupportEmailConfigured(processEnv) || !isContactDeliveryConfigured(processEnv)) {
      logSupportContactEmailOutcome({
        outcome: "skipped",
        reason: isSupportEmailConfigured(processEnv) ? "not_configured" : "missing_support_email",
      });
      throw new AppError(503, CONTACT_UNAVAILABLE_MESSAGE);
    }

    const supportEmail = readEmailRuntimeConfig(processEnv).supportEmail!;
    const replyTo = stripHeaderInjection(input.email);

    try {
      await sendSupportContactEmail({
        name: stripHeaderInjection(input.name),
        email: replyTo,
        subject: stripHeaderInjection(input.subject),
        message: input.message,
        to: supportEmail,
      });
    } catch (error) {
      const httpStatus = error instanceof EmailDeliveryError ? error.httpStatus : undefined;
      logSupportContactEmailOutcome({
        outcome: "failed",
        reason: "provider_failed",
        httpStatus,
      });
      throw new AppError(503, CONTACT_UNAVAILABLE_MESSAGE);
    }

    logSupportContactEmailOutcome({ outcome: "sent" });
    return { sent: true };
  }
}

export const contactService = new ContactService();
