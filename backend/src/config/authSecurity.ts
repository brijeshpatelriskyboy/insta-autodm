export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RESET_TTL_MS = 45 * 60 * 1000;

export const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, we've sent password reset instructions.";

export const INVALID_RESET_TOKEN_MESSAGE = "Invalid or expired reset token";

export const AUTH_RATE_LIMIT_MESSAGE = "Too many attempts. Try again later.";

/** Conservative beta limits — auth routes only. */
export const AUTH_RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, max: 10 },
  register: { windowMs: 15 * 60 * 1000, max: 5 },
  forgotPassword: { windowMs: 15 * 60 * 1000, max: 5 },
  resetPassword: { windowMs: 15 * 60 * 1000, max: 8 },
} as const;

/**
 * Test-only helper to mint/inspect reset tokens.
 * Never enabled when NODE_ENV=production, even if AUTH_DEV_RETURN_RESET_TOKEN is set.
 */
export function isResetTokenTestHelperEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv === "test" || nodeEnv === "development";
}
