export function buildSupportContactEmail(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  receivedAt: Date;
}): { subject: string; html: string; text: string } {
  const subject = `[Comment2DM support] ${input.subject}`;
  const received = input.receivedAt.toISOString();

  const text = [
    "Comment2DM support request",
    "",
    `From: ${input.name}`,
    `Email: ${input.email}`,
    `Subject: ${input.subject}`,
    `Received: ${received}`,
    "",
    input.message,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head>
  <body style="font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;">
    <h1 style="font-size:18px;">Comment2DM support request</h1>
    <p><strong>From:</strong> ${escapeHtml(input.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
    <p><strong>Subject:</strong> ${escapeHtml(input.subject)}</p>
    <p><strong>Received:</strong> ${escapeHtml(received)}</p>
    <pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(input.message)}</pre>
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
