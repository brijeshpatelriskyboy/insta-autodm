import type { EmailMessage, EmailProvider } from "./types";
import { EmailDeliveryError } from "./types";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly shcFromAddress?: string,
    private readonly shcApiKey?: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    let from = this.from;
    if (message.brand === "student_help_centre") {
      // Only server-configured SHC messages may use the separately verified domain.
      // Until configured, keep the existing working sender address.
      const configuredSender = this.shcFromAddress?.trim() ? this.shcFromAddress : this.from;
      const address = this.shcFromAddress?.trim()
        ? this.shcFromAddress.trim()
        : (this.from.match(/<([^<>]+)>\s*$/)?.[1] || this.from).trim();
      if (/[\r\n\0]/.test(configuredSender) || !/^[^\s<>@,]+@[^\s<>@,]+$/.test(address)) {
        throw new EmailDeliveryError("invalid_config");
      }
      from = `Student Help Centre <${address}>`;
    }
    const response = await this.fetchImpl(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${message.brand === "student_help_centre" && this.shcApiKey?.trim() ? this.shcApiKey.trim() : this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      // Do not include response body — it may echo HTML/reset URLs.
      throw new EmailDeliveryError("provider_failed", response.status);
    }
  }
}

