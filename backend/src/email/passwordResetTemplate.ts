import { PASSWORD_RESET_EXPIRY_MINUTES } from "./types";

export function buildPasswordResetEmail(input: {
  resetUrl: string;
  expiresMinutes?: number;
}): { subject: string; html: string; text: string } {
  const minutes = input.expiresMinutes ?? PASSWORD_RESET_EXPIRY_MINUTES;
  const subject = "Reset your Comment2DM password";

  const text = [
    "Comment2DM password reset",
    "",
    "We received a request to reset the password for your Comment2DM account.",
    "",
    `Reset your password (link expires in ${minutes} minutes):`,
    input.resetUrl,
    "",
    "If you did not request a password reset, you can ignore this email. Your password will stay the same.",
    "",
    "Comment2DM",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">Comment2DM</p>
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;">Password reset</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155;">
                  We received a request to reset the password for your Comment2DM account.
                </p>
                <p style="margin:0 0 28px;">
                  <a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">
                    Reset password
                  </a>
                </p>
                <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#475569;">
                  This link expires in ${minutes} minutes.
                </p>
                <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#475569;">
                  If the button does not work, copy and paste this URL into your browser:
                </p>
                <p style="margin:0 0 20px;font-size:12px;line-height:1.5;word-break:break-all;color:#64748b;">
                  ${escapeHtml(input.resetUrl)}
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  If you did not request a password reset, you can ignore this email. Your password will stay the same.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
