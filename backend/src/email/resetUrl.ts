/**
 * Build the password-reset URL from operator-configured FRONTEND_URL only.
 * Path is fixed to /reset-password. No user-controlled next/redirect params.
 */
export function buildPasswordResetUrl(frontendUrl: string, token: string): string {
  if (!token || token.length < 8) {
    throw new Error("Reset token is missing");
  }

  let parsed: URL;
  try {
    parsed = new URL(frontendUrl);
  } catch {
    throw new Error("FRONTEND_URL is invalid");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("FRONTEND_URL must be http or https");
  }

  parsed.pathname = "/reset-password";
  parsed.search = "";
  parsed.hash = "";
  parsed.searchParams.set("token", token);
  return parsed.toString();
}
