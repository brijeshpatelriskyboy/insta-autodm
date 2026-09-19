export const PASSWORD_RESET_EXPIRY_MINUTES = 45;

export type EmailKind =
  | "password_reset"
  | "support_contact"
  | "security_notification";

export interface EmailMessage {
  kind: EmailKind;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

export class EmailDeliveryError extends Error {
  constructor(
    public readonly code: "not_configured" | "invalid_config" | "provider_failed",
    public readonly httpStatus?: number,
  ) {
    super("Email delivery failed");
    this.name = "EmailDeliveryError";
  }
}
