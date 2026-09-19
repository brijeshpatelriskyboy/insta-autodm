import type { EmailMessage, EmailProvider } from "./types";
import { EmailDeliveryError } from "./types";

export class DisabledEmailProvider implements EmailProvider {
  readonly name = "disabled";

  async send(_message: EmailMessage): Promise<void> {
    throw new EmailDeliveryError("not_configured");
  }
}
