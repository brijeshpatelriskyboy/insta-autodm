import { env } from "./env";

export interface EmailRuntimeConfig {
  resendApiKey: string | undefined;
  emailFrom: string | undefined;
  frontendUrl: string;
}

export function readEmailRuntimeConfig(
  processEnv: NodeJS.ProcessEnv = process.env,
): EmailRuntimeConfig {
  const frontendUrl = (
    processEnv.FRONTEND_URL?.trim() ||
    env.FRONTEND_URL ||
    ""
  ).replace(/\/$/, "");

  return {
    resendApiKey: processEnv.RESEND_API_KEY?.trim() || undefined,
    emailFrom: processEnv.EMAIL_FROM?.trim() || undefined,
    frontendUrl,
  };
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Delivery is ready only when Resend, From, and a usable FRONTEND_URL are set.
 * Production/staging (NODE_ENV=production) rejects localhost reset links.
 */
export function isEmailDeliveryConfigured(
  processEnv: NodeJS.ProcessEnv = process.env,
): boolean {
  const config = readEmailRuntimeConfig(processEnv);
  if (!config.resendApiKey || !config.emailFrom || !config.emailFrom.includes("@")) {
    return false;
  }
  if (!isHttpUrl(config.frontendUrl)) {
    return false;
  }
  const nodeEnv = processEnv.NODE_ENV || env.NODE_ENV;
  if (nodeEnv === "production") {
    try {
      const host = new URL(config.frontendUrl).hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

/** Safe for logs — never includes API keys, tokens, or reset URLs. */
export function emailDeliveryStatusForLogs(
  processEnv: NodeJS.ProcessEnv = process.env,
): {
  configured: boolean;
  hasResendApiKey: boolean;
  hasEmailFrom: boolean;
  hasFrontendUrl: boolean;
} {
  const config = readEmailRuntimeConfig(processEnv);
  return {
    configured: isEmailDeliveryConfigured(processEnv),
    hasResendApiKey: Boolean(config.resendApiKey),
    hasEmailFrom: Boolean(config.emailFrom),
    hasFrontendUrl: Boolean(config.frontendUrl),
  };
}
