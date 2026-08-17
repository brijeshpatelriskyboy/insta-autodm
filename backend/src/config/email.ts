import { env } from "./env";

export interface EmailRuntimeConfig {
  resendApiKey: string | undefined;
  emailFrom: string | undefined;
  frontendUrl: string;
  supportEmail: string | undefined;
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
    supportEmail: processEnv.SUPPORT_EMAIL?.trim() || undefined,
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

export function isSupportEmailConfigured(
  processEnv: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = readEmailRuntimeConfig(processEnv).supportEmail;
  return Boolean(
    value &&
      value.includes("@") &&
      !/[\r\n\0]/.test(value) &&
      value.length <= 254,
  );
}

/**
 * Contact delivery needs a support inbox plus the same Resend/From setup as
 * other transactional mail. Tests use the in-memory provider, so only
 * SUPPORT_EMAIL is required there.
 */
export function isContactDeliveryConfigured(
  processEnv: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isSupportEmailConfigured(processEnv)) {
    return false;
  }
  if ((processEnv.NODE_ENV || env.NODE_ENV) === "test") {
    return true;
  }
  return isEmailDeliveryConfigured(processEnv);
}

/** Safe for logs — never includes API keys, tokens, or reset URLs. */
export function emailDeliveryStatusForLogs(
  processEnv: NodeJS.ProcessEnv = process.env,
): {
  configured: boolean;
  hasResendApiKey: boolean;
  hasEmailFrom: boolean;
  hasFrontendUrl: boolean;
  hasSupportEmail: boolean;
} {
  const config = readEmailRuntimeConfig(processEnv);
  return {
    configured: isEmailDeliveryConfigured(processEnv),
    hasResendApiKey: Boolean(config.resendApiKey),
    hasEmailFrom: Boolean(config.emailFrom),
    hasFrontendUrl: Boolean(config.frontendUrl),
    hasSupportEmail: isSupportEmailConfigured(processEnv),
  };
}
