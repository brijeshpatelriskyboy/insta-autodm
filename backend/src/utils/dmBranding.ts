import { AppError } from "./errors";

export const DM_BRANDING = "Powered by Comment2DM";
export const DM_BODY_MAX_LENGTH = 1000 - DM_BRANDING.length - 2;

/** Applied at the delivery boundary so existing rules and retries are branded. */
export function brandDm(message: string): string {
  const body = message.trimEnd();
  const branded = body.endsWith(DM_BRANDING) ? body : `${body}\n\n${DM_BRANDING}`;
  if (branded.length > 1000) {
    // Never silently cut a customer's message or its destination link.
    throw new AppError(400, `Shorten the DM message to ${DM_BODY_MAX_LENGTH} characters to leave room for Powered by Comment2DM.`);
  }
  return branded;
}
