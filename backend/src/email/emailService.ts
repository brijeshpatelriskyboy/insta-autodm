import { isEmailDeliveryConfigured, readEmailRuntimeConfig } from "../config/email";
import { DisabledEmailProvider } from "./emailProviders";
import { MemoryEmailProvider } from "./memoryProvider";
import { buildPasswordResetEmail } from "./passwordResetTemplate";
import { buildSupportContactEmail } from "./supportContactTemplate";
import { ResendEmailProvider } from "./resendProvider";
import type { EmailMessage, EmailProvider } from "./types";
import { PASSWORD_RESET_EXPIRY_MINUTES } from "./types";

const memoryProvider = new MemoryEmailProvider();
let providerOverrideForTests: EmailProvider | null = null;

export function resetEmailProviderForTests(): void {
  memoryProvider.reset();
  providerOverrideForTests = null;
}

export function setEmailProviderForTests(provider: EmailProvider): void {
  providerOverrideForTests = provider;
}

export function getMemoryEmailProvider(): MemoryEmailProvider {
  return memoryProvider;
}

export function createEmailProvider(
  processEnv: NodeJS.ProcessEnv = process.env,
): EmailProvider {
  if (providerOverrideForTests) {
    return providerOverrideForTests;
  }
  if (processEnv.NODE_ENV === "test") {
    return memoryProvider;
  }
  if (isEmailDeliveryConfigured(processEnv)) {
    const config = readEmailRuntimeConfig(processEnv);
    return new ResendEmailProvider(config.resendApiKey!, config.emailFrom!);
  }
  return new DisabledEmailProvider();
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  await createEmailProvider().send(message);
}

export async function sendSupportContactEmail(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  to: string;
}): Promise<void> {
  const content = buildSupportContactEmail({
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
    receivedAt: new Date(),
  });
  await sendEmail({
    kind: "support_contact",
    to: input.to,
    replyTo: input.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
  expiresMinutes?: number;
}): Promise<void> {
  const content = buildPasswordResetEmail({
    resetUrl: input.resetUrl,
    expiresMinutes: input.expiresMinutes ?? PASSWORD_RESET_EXPIRY_MINUTES,
  });
  await sendEmail({
    kind: "password_reset",
    to: input.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
}

/** Safe operational log line — never include token, reset URL, or API key. */
export function logPasswordResetEmailOutcome(input: {
  outcome: "sent" | "skipped" | "failed";
  reason?: string;
  httpStatus?: number;
}): void {
  console.info("[auth] password-reset email", {
    outcome: input.outcome,
    reason: input.reason,
    httpStatus: input.httpStatus,
    provider: createEmailProvider().name,
  });
}

/** Safe operational log line — never include message body, Reply-To, or API key. */
export function logSupportContactEmailOutcome(input: {
  outcome: "sent" | "skipped" | "failed";
  reason?: string;
  httpStatus?: number;
}): void {
  console.info("[contact] support email", {
    outcome: input.outcome,
    reason: input.reason,
    httpStatus: input.httpStatus,
    provider: createEmailProvider().name,
  });
}
