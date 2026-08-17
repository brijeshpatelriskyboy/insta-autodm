import type { EmailMessage, EmailProvider } from "./types";

export class MemoryEmailProvider implements EmailProvider {
  readonly name = "memory";
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push({ ...message });
  }

  reset(): void {
    this.sent.length = 0;
  }
}
